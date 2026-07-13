import { io } from 'socket.io-client';
import { lookInSession } from './session';
import { queryKeys } from './queryKeys';

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

/**
 * Connect socket events to the TanStack Query cache.
 *
 * Instead of fetching data directly in socket handlers, we invalidate
 * the relevant queries — TanStack Query decides whether to refetch
 * based on whether any component is currently observing that query.
 *
 * Call once when the socket connects (typically in a top-level component).
 *
 * @param {import('socket.io-client').Socket} sock - The socket instance
 * @param {import('@tanstack/react-query').QueryClient} queryClient - The TanStack Query client
 */
export const connectSocketToQueryCache = (sock, queryClient) => {
    if (!sock || !queryClient) return;

    sock.on('new_message', () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.messages.unreadTotal() });
        queryClient.invalidateQueries({ queryKey: queryKeys.messages.conversations() });
    });

    sock.on('new_notification', () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread() });
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    });

    sock.on('blog_updated', ({ blog_id }) => {
        if (blog_id) {
            queryClient.invalidateQueries({ queryKey: queryKeys.blogs.detail(blog_id) });
        }
    });
};

export default getSocket;

