import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { AUTH } from '../constants/auth.constants.js';

/**
 * Cross-instance broadcast. Without a Redis adapter, `io.to(room).emit(...)` only reaches sockets
 * on the SAME process — so on Cloud Run (which autoscales to many instances) real-time silently
 * breaks whenever the emitting request and the recipient's socket land on different instances.
 *
 * Uses the Upstash REDIS PROTOCOL endpoint (REDIS_URL = rediss://default:<pw>@host:port), which is
 * distinct from the REST client used for response caching (the REST API can't do pub/sub). Degrades
 * gracefully to single-instance if REDIS_URL is unset, so nothing crashes before it's configured.
 */
const attachRedisAdapter = (io) => {
    const url = process.env.REDIS_URL;
    if (!url) {
        console.warn('[Socket] REDIS_URL not set — single-instance mode. Real-time will NOT broadcast across multiple Cloud Run instances until REDIS_URL is configured.');
        return;
    }
    try {
        // maxRetriesPerRequest: null is required for the long-lived pub/sub (subscriber) connection.
        const pubClient = new Redis(url, { maxRetriesPerRequest: null });
        const subClient = pubClient.duplicate();
        pubClient.on('error', (e) => console.error('[Socket] Redis pub error:', e.message));
        subClient.on('error', (e) => console.error('[Socket] Redis sub error:', e.message));
        io.adapter(createAdapter(pubClient, subClient));
        io.redisClients = [pubClient, subClient]; // exposed so graceful shutdown can quit them
        console.log('[Socket] Redis adapter enabled — multi-instance broadcast active');
    } catch (err) {
        console.error('[Socket] Redis adapter setup failed; falling back to single-instance:', err.message);
    }
};

/**
 * Initialize Socket.IO with JWT authentication.
 * Users join a personal room `user:<userId>`; viewers of a post join `blog:<blogId>`.
 */
export const initSocket = (httpServer, allowedOrigins) => {
    const io = new Server(httpServer, {
        cors: {
            origin: allowedOrigins,
            methods: ['GET', 'POST'],
            credentials: true
        },
        // Reduce connection overhead
        pingInterval: 25000,
        pingTimeout: 20000,
    });

    attachRedisAdapter(io);

    // Auth middleware — verify JWT from handshake
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, { clockTolerance: AUTH.CLOCK_TOLERANCE_S });
            socket.userId = decoded.id;
            next();
        } catch (err) {
            return next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.userId;

        // Join personal room for targeted event delivery
        socket.join(`user:${userId}`);

        // Blog rooms — a client viewing a post joins so live like/comment counts can be pushed to it.
        socket.on('join_blog', (blogId) => { if (blogId) socket.join(`blog:${blogId}`); });
        socket.on('leave_blog', (blogId) => { if (blogId) socket.leave(`blog:${blogId}`); });

        // Handle user typing indicator
        socket.on('typing', ({ conversation_id, recipient_id }) => {
            io.to(`user:${recipient_id}`).emit('user_typing', {
                conversation_id,
                user_id: userId
            });
        });

        socket.on('stop_typing', ({ conversation_id, recipient_id }) => {
            io.to(`user:${recipient_id}`).emit('user_stop_typing', {
                conversation_id,
                user_id: userId
            });
        });

        socket.on('disconnect', () => {
            // Cleanup handled by Socket.IO automatically
        });
    });

    return io;
};
