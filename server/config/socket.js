import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

/**
 * Initialize Socket.IO with JWT authentication.
 * Users join a personal room `user:<userId>` so we can emit events to them.
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

    // Auth middleware — verify JWT from handshake
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
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
