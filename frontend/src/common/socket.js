import { io } from 'socket.io-client';
import { lookInSession } from './session';
import { queryKeys } from './queryKeys';
import { ensureFreshToken } from './api';

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
        // auth as a FUNCTION: called on EVERY connection attempt (initial + all reconnects), so each
        // handshake carries a guaranteed-fresh access token. Access tokens only live 15 minutes and
        // the session persists in localStorage for days, so a page load usually starts with an
        // expired token — ensureFreshToken() refreshes it (single-flight, shared with axios) before
        // the socket ever presents it, instead of getting rejected and needing recovery.
        auth: (cb) => {
            ensureFreshToken()
                .then((token) => {
                    if (token) return cb({ token });
                    // No refreshable session — fall back to whatever is stored (server will reject,
                    // and the connect_error recovery below retries with backoff).
                    const u = lookInSession("user");
                    try { cb({ token: u ? JSON.parse(u).access_token : '' }); } catch { cb({ token: '' }); }
                })
                .catch(() => cb({ token: '' }));
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        // Never give up: socket.io keeps retrying with a capped (~5s) backoff, so real-time recovers
        // whenever connectivity returns. A finite cap would leave the socket permanently dead after a
        // long outage (laptop sleep, tunnel, VPN drop), since getSocket() reuses the single instance.
        reconnectionAttempts: Infinity
    });

    // Auth-rejection recovery. When the server's socket middleware rejects the handshake, Socket.IO
    // does NOT auto-reconnect: socket.active === false and the manager never schedules a retry, so
    // without this the socket would stay dead for the whole visit. Retrying re-runs the auth
    // function above, which refreshes the token — so this recovers from any transient auth failure.
    // Backoff caps the retries when the session is truly dead (user must re-login).
    let authRetry = 0;

    socket.on('connect', () => {
        authRetry = 0;
        console.log('[Socket] Connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
        console.warn('[Socket] Connection error:', err.message);
        if (socket.active) return; // transport-level failure — the manager auto-reconnects
        const delay = Math.min(60_000, 2_000 * 2 ** Math.min(authRetry++, 5));
        setTimeout(() => {
            if (!socket || socket.connected) return; // disconnected via logout, or already recovered
            if (!lookInSession("user")) return;      // logged out — nothing to reconnect with
            socket.connect(); // the auth function fetches a fresh token for this attempt
        }, delay);
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

