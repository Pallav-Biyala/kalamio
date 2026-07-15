import { io } from 'socket.io-client';
import { lookInSession } from './session';
import { queryKeys } from './queryKeys';

let socket = null;

// Proactively reconnect a dropped socket the moment the network returns — snappier than waiting for
// the next backoff retry. connect() is a no-op on an already-connected socket, so this is safe.
if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
        if (socket && !socket.connected) socket.connect();
    });
}

/**
 * Get or create a Socket.IO connection.
 * Uses the JWT from session for authentication.
 */
export const getSocket = () => {
    // Reuse the single instance whatever its state (connecting / connected / reconnecting).
    // Checking `.connected` here would spawn a NEW socket on every call made during the initial
    // connecting window — several components call getSocket() on mount, so that created duplicate
    // connections and split listeners across them.
    if (socket) return socket;

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
        // Never give up: socket.io keeps retrying with a capped (~5s) backoff, so real-time recovers
        // whenever connectivity returns. A finite cap would leave the socket permanently dead after a
        // long outage (laptop sleep, tunnel, VPN drop), since getSocket() reuses the single instance.
        reconnectionAttempts: Infinity
    });

    // On every reconnect attempt, re-read the (possibly refreshed) token from session so an expired
    // token can't permanently break real-time after a network blip.
    socket.io.on('reconnect_attempt', () => {
        const u = lookInSession("user");
        if (u) {
            try { socket.auth = { token: JSON.parse(u).access_token }; } catch { /* keep old auth */ }
        }
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
    // Idempotent — only wire the bridge once per socket instance, even if called on every re-render.
    if (sock._cacheBridged) return;
    sock._cacheBridged = true;

    sock.on('new_message', () => {
        // The unread-total badge query IS a React Query; the conversation list is local state on the
        // messages page (refreshed by its own new_message listener), so we don't invalidate it here.
        queryClient.invalidateQueries({ queryKey: queryKeys.messages.unreadTotal() });
    });

    sock.on('new_notification', () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread() });
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    });
    // (blog_updated — live like/comment counts — is handled directly by the blog page, which keys
    // its room/state on the post _id rather than the slug used by the blogs.detail query.)
};

export default getSocket;

