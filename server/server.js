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

// Middleware
import errorHandler from './middleware/errorHandler.js';

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

const server = express();
const httpServer = createServer(server);
const PORT = process.env.PORT || 8080;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ── Global middleware ──────────────────────────────────────────────
server.use(helmet({
    contentSecurityPolicy: false, // API-only server, CSP is for HTML documents
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow S3 image loading
    crossOriginEmbedderPolicy: false, // Allow embedding cross-origin resources (S3 images)
}));

// Compress all API responses (gzip/brotli)
server.use(compression());

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

// ── Mount routes under /api prefix ──────────────────────────────────
server.use('/api', authRoutes);
server.use('/api', blogRoutes);
server.use('/api', commentRoutes);
server.use('/api', notificationRoutes);
server.use('/api', userRoutes);
server.use('/api', uploadRoutes);
server.use('/api', followRoutes);
server.use('/api', connectRoutes);
server.use('/api', publicationRoutes);
server.use('/api', messageRoutes);

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
    console.log(`🚀 Server listening on http://0.0.0.0:${PORT}`);

    // 2. Connect to DB AFTER server is already accepting traffic
    connectDB().catch(err => {
        console.error('❌ DB connection error (non-fatal):', err.message);
    });
});