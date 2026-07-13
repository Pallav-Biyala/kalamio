import axios from 'axios';
import { lookInSession, storeInSession, removeFromSession } from './session';
import toast from 'react-hot-toast';

// Fail loud, not silent: without VITE_SERVER_DOMAIN the base URL becomes
// "undefinedapi/v1" and every request 404s against the dev server — a confusing
// symptom that usually means a fresh clone is missing its .env file.
const SERVER_DOMAIN = import.meta.env.VITE_SERVER_DOMAIN;
if (!SERVER_DOMAIN) {
    console.error(
        '[Kalamio] VITE_SERVER_DOMAIN is not set — API requests will fail.\n' +
        'Fix: copy frontend/.env.example to frontend/.env, then restart the dev server.',
    );
}

const api = axios.create({
    baseURL: (SERVER_DOMAIN || '') + 'api/v1',
});

// ── Token expiry helpers ────────────────────────────────────────────

/**
 * Decode JWT payload without verification (we only need the `exp` claim).
 * Returns null if the token is malformed.
 */
const decodeTokenPayload = (token) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(base64));
    } catch {
        return null;
    }
};

/**
 * Returns true if the access token is expired or will expire within `bufferMs`.
 * A 30-second buffer ensures we refresh before the server rejects us.
 */
const isTokenExpiringSoon = (token, bufferMs = 30_000) => {
    const payload = decodeTokenPayload(token);
    if (!payload?.exp) return true; // malformed → treat as expired
    return payload.exp * 1000 <= Date.now() + bufferMs;
};

// ── Shared refresh state ────────────────────────────────────────────

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

/**
 * Perform the actual token refresh. Shared between request and response
 * interceptors so we never have two refreshes running concurrently.
 * Returns the new access_token on success, or throws on failure.
 */
const doRefresh = async () => {
    const userSession = lookInSession("user");
    if (!userSession) throw new Error("No session");

    const userData = JSON.parse(userSession);
    const { refresh_token } = userData;
    if (!refresh_token) throw new Error("No refresh token");

    const refreshUrl = `${import.meta.env.VITE_SERVER_DOMAIN}api/v1/refresh-token`;
    const { data } = await axios.post(refreshUrl, { refresh_token });

    // Persist new tokens
    userData.access_token = data.access_token;
    if (data.refresh_token) userData.refresh_token = data.refresh_token;
    storeInSession("user", JSON.stringify(userData));

    return data.access_token;
};

// ── Deduped toast helper ────────────────────────────────────────────
// Prevents the same error toast from firing multiple times in a short window.
// When the device goes offline several parallel requests fail at once —
// this ensures only a single toast is shown per error category.
const _toastCooldowns = {};
const TOAST_COOLDOWN_MS = 3000;

const showDedupedToast = (message, key) => {
    if (_toastCooldowns[key]) return; // already showing — skip
    toast.error(message);
    _toastCooldowns[key] = setTimeout(() => {
        delete _toastCooldowns[key];
    }, TOAST_COOLDOWN_MS);
};

// ── Request interceptor — proactive token refresh ───────────────────

// Checks token expiry BEFORE the request is sent. If expired, refreshes
// first so the request goes out with a valid token (no 401 cascade).

api.interceptors.request.use(async (config) => {
    const userSession = lookInSession("user");
    if (!userSession) return config;

    const userData = JSON.parse(userSession);
    const { access_token } = userData;
    if (!access_token) return config;

    // Skip proactive refresh for auth-flow endpoints
    const authFlowPaths = ['/exchange-auth-code', '/signin', '/signup', '/verify-email', '/refresh-token'];
    if (authFlowPaths.some(p => config.url?.includes(p))) {
        config.headers.Authorization = `Bearer ${access_token}`;
        return config;
    }

    // If the token is still valid, attach and proceed
    if (!isTokenExpiringSoon(access_token)) {
        config.headers.Authorization = `Bearer ${access_token}`;
        return config;
    }

    // Token is expired or about to expire — refresh before sending
    if (isRefreshing) {
        // Another request already triggered the refresh; wait for it
        const newToken = await new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
        });
        config.headers.Authorization = `Bearer ${newToken}`;
        return config;
    }

    // We are the first to detect expiry — start the refresh
    isRefreshing = true;
    try {
        const newToken = await doRefresh();
        processQueue(null, newToken);
        config.headers.Authorization = `Bearer ${newToken}`;
    } catch (err) {
        processQueue(err, null);
        // Let the request go out with the stale token; the response
        // interceptor will handle the 401 and redirect to sign-in.
        config.headers.Authorization = `Bearer ${access_token}`;
    } finally {
        isRefreshing = false;
    }

    return config;
});

// ── Response interceptor — safety net for edge cases ────────────────
// Kept as a fallback in case the proactive check misses an edge case
// (e.g. token revoked server-side, clock skew, etc.).

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;

        // Skip token-refresh for login-flow endpoints — a 401 here means
        // invalid credentials or expired auth code, NOT an expired session.
        const authFlowPaths = ['/exchange-auth-code', '/signin', '/signup', '/verify-email', '/refresh-token'];
        const isAuthFlow = authFlowPaths.some(p => originalRequest.url?.includes(p));

        // If 401 and we haven't retried yet (and it's not a login-flow endpoint)
        if (status === 401 && !originalRequest._retry && !isAuthFlow) {

            // If already refreshing, queue the request
            if (isRefreshing) {
                return new Promise(function(resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = 'Bearer ' + token;
                    return api(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const newToken = await doRefresh();
                processQueue(null, newToken);
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                isRefreshing = false;

                // Retry original request with new token
                return api(originalRequest);
            } catch (err) {
                // Flag so React Query's retry policy won't retry a dead session
                // (the refresh failed — retrying just re-hits 401 and re-triggers
                // this redirect/toast). The flag rides on the same error object
                // that processQueue rejects queued requests with.
                if (err && typeof err === 'object') err.__sessionExpired = true;
                processQueue(err, null);
                isRefreshing = false;
                removeFromSession("user");
                showDedupedToast("Session expired. Please log in again.", "session-expired");
                setTimeout(() => window.location.href = "/signin", 1500);
                return Promise.reject(err);
            }
        }

        // ── Non-401 error handling ─────────────────────────────────────
        // Use a short cooldown so that when multiple requests fail at once
        // (e.g. device goes offline), only ONE toast is shown — not one per request.
        if (status === 429) {
            showDedupedToast("Too many requests. Please slow down.", "rate-limit");
        } else if (status >= 500) {
            showDedupedToast("Server error. Please try again later.", "server-error");
        } else if (!status) {
            // Network error — no response at all (offline, DNS failure, etc.)
            showDedupedToast("You're offline. Check your connection.", "network-offline");
        }

        return Promise.reject(error);
    }
);

export default api;
