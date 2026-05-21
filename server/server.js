import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
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

// Global middleware
server.use(helmet({
    contentSecurityPolicy: false, // API-only server, CSP is for HTML documents
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow S3 image loading
    crossOriginEmbedderPolicy: false, // Allow embedding cross-origin resources (S3 images)
}));
server.use(express.json({ limit: '10mb' }));

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://kalamio.com',
    'https://www.kalamio.com',
    'https://dev.kalamio.com',
    process.env.FRONTEND_URL,
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

// Health check — Cloud Run uses this to verify container is alive
server.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Mount routes under /api prefix
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

// 1. Start listening IMMEDIATELY so Cloud Run sees port 8080 open
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on http://0.0.0.0:${PORT}`);

    // 2. Connect to DB AFTER server is already accepting traffic
    connectDB().catch(err => {
        console.error('❌ DB connection error (non-fatal):', err.message);
    });
});