import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import "dotenv/config";

// Config
import './config/env.js';
import connectDB from './config/db.js';
import { initializePassport } from './config/passport.js';
import { initSocket } from './config/socket.js';

import logger from './config/logger.js';

// Middleware
import errorHandler from './middleware/errorHandler.js';
import requestLogger from './middleware/requestLogger.js';
import originGuard from './middleware/originGuard.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import blogRoutes from './routes/blog.routes.js';
import commentRoutes from './routes/comment.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import userRoutes from './routes/user.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import followRoutes from './routes/follow.routes.js';
import connectRoutes from './routes/connect.routes.js';
import publicationRoutes from './routes/publication.routes.js';
import messageRoutes from './routes/message.routes.js';
import metadataRoutes from './routes/metadata.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import blockRoutes from './routes/block.routes.js';
import collectionRoutes from './routes/collection.routes.js';
import readRoutes from './routes/read.routes.js';
import prerenderRoutes from './routes/prerender.routes.js';
import sitemapRoutes from './routes/sitemap.routes.js';

const server = express();
const httpServer = createServer(server);
const PORT = process.env.PORT || 8080;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Behind Cloudflare → nginx → Cloud Run, so req.ip/req.protocol/req.secure must
// honour X-Forwarded-* (rate limiting keys off CF-Connecting-IP, see rateLimiter).
server.set('trust proxy', true);

// ── Global middleware ──────────────────────────────────────────────
server.use(helmet({
    contentSecurityPolicy: false, // API-only server, CSP is for HTML documents
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow S3 image loading
    crossOriginEmbedderPolicy: false, // Allow embedding cross-origin resources (S3 images)
}));

// Compress all API responses (gzip/brotli)
server.use(compression());

// Structured request logging (JSON with request IDs)
server.use(requestLogger);

// Default body limit — 10kb for most routes (prevents payload abuse)
server.use(express.json({ limit: '10kb' }));

// CORS — restrict origins based on environment
const allowedOrigins = [
    'https://kalamio.com',
    'https://www.kalamio.com',
    'https://dev.kalamio.com',
    process.env.FRONTEND_URL,
    // Only allow localhost in development
    ...(IS_PRODUCTION ? [] : ['http://localhost:5173', 'http://localhost:5174']),
].filter(Boolean);

server.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// Reject direct-to-origin traffic that bypassed Cloudflare (opt-in via env).
server.use(originGuard);

// Secure caching default: no intermediary (Cloudflare/browser) caches an API
// response unless a handler explicitly opts in with a public Cache-Control
// (see cacheResponse). Prevents accidental edge-caching of per-user data.
server.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// Initialize Passport (Google OAuth)
initializePassport(server);

// Initialize Socket.IO and store reference for controllers
const io = initSocket(httpServer, allowedOrigins);
server.set('io', io);

// ── Health check — Cloud Run uses this to verify container is alive ──
server.get('/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const dbStatus = dbState === 1 ? 'connected' : 'disconnected';
    const isHealthy = dbState === 1;

    res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'ok' : 'degraded',
        db: dbStatus,
        uptime: Math.floor(process.uptime()),
    });
});

// ── Mount routes under /api/v1 prefix (versioned API) ───────────────
server.use('/api/v1', authRoutes);
server.use('/api/v1', blogRoutes);
server.use('/api/v1', commentRoutes);
server.use('/api/v1', notificationRoutes);
server.use('/api/v1', userRoutes);
server.use('/api/v1', uploadRoutes);
server.use('/api/v1', followRoutes);
server.use('/api/v1', connectRoutes);
server.use('/api/v1', publicationRoutes);
server.use('/api/v1', messageRoutes);
server.use('/api/v1', metadataRoutes);
server.use('/api/v1', settingsRoutes);
server.use('/api/v1', analyticsRoutes);
server.use('/api/v1', blockRoutes);
server.use('/api/v1', collectionRoutes);
server.use('/api/v1', readRoutes);
server.use('/api/v1', prerenderRoutes);
server.use('/api/v1', sitemapRoutes);

// Backward compat: /api/* → /api/v1/* redirect (remove once all clients updated)
server.use('/api', (req, res, next) => {
    // Only redirect if not already /api/v1
    if (!req.originalUrl.startsWith('/api/v1')) {
        return res.redirect(307, req.originalUrl.replace('/api', '/api/v1'));
    }
    next();
});

// Catch-all 404 for undefined API routes
server.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global error handler (must be after routes)
server.use(errorHandler);

// ── Process-level error handlers ────────────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️  Unhandled Rejection:', reason);
    // Don't crash — log and continue
});

process.on('uncaughtException', (error) => {
    console.error('🔥 Uncaught Exception:', error);
    // Give time to flush logs, then exit
    setTimeout(() => process.exit(1), 1000);
});

// ── Graceful shutdown ───────────────────────────────────────────────
const gracefulShutdown = (signal) => {
    console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);

    // Stop accepting new connections
    httpServer.close(async () => {
        console.log('✅ HTTP server closed');

        try {
            // Close MongoDB connection
            await mongoose.connection.close();
            console.log('✅ MongoDB connection closed');
        } catch (err) {
            console.error('❌ Error closing MongoDB:', err.message);
        }

        process.exit(0);
    });

    // Force shutdown after 10 seconds if graceful shutdown stalls
    setTimeout(() => {
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ── Start server ────────────────────────────────────────────────────
// 1. Start listening IMMEDIATELY so Cloud Run sees port 8080 open
httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT }, `Server listening on http://0.0.0.0:${PORT}`);

    // 2. Connect to DB AFTER server is already accepting traffic
    connectDB().catch(err => {
        console.error('❌ DB connection error (non-fatal):', err.message);
    });
});

// Request timeout — kill stalled requests after 30 seconds
httpServer.timeout = 30000;