import { io } from 'socket.io-client';
import { lookInSession } from './session';

let socket = null;

/**
 * Get or create a Socket.IO connection.
 * Uses the JWT from session for authentication.
 */
export const getSocket = () => {
    if (socket?.connected) return socket;

    const user = lookInSession("user");
    if (!user) return null;

    const { access_token } = JSON.parse(user);
    if (!access_token) return null;

    const serverUrl = import.meta.env.VITE_SERVER_DOMAIN || 'http://localhost:8080';

    socket = io(serverUrl, {
        auth: { token: access_token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10
    });

    socket.on('connect', () => {
        console.log('[Socket] Connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
        console.warn('[Socket] Connection error:', err.message);
    });

    return socket;
};

/**
 * Disconnect and clean up socket.
 */
export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

export default getSocket;
