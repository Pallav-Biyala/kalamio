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

// ── Cross-tab refresh coordination ──────────────────────────────────
// localStorage is shared across tabs, and refresh tokens rotate — so two tabs refreshing at once
// used to race: the loser's (already-rotated) token got rejected and hard-logged the user out.
// A storage-based lock makes the refresh single-flight per BROWSER, not just per tab; the other
// tabs simply wait and pick the fresh token up from storage.

const REFRESH_LOCK_KEY = "kalamio:refresh-lock";
const REFRESH_LOCK_TTL_MS = 10_000; // a crashed tab's lock goes stale after this
const _tabLockId = Math.random().toString(36).slice(2);

const tryAcquireRefreshLock = () => {
    try {
        const raw = localStorage.getItem(REFRESH_LOCK_KEY);
        if (raw) {
            const { t } = JSON.parse(raw);
            if (Date.now() - t < REFRESH_LOCK_TTL_MS) return false; // held by another tab
        }
        localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify({ id: _tabLockId, t: Date.now() }));
        // Re-read to confirm we won (two tabs can write "simultaneously"; last write wins).
        return JSON.parse(localStorage.getItem(REFRESH_LOCK_KEY) || "{}").id === _tabLockId;
    } catch {
        return true; // storage unavailable — just refresh directly
    }
};

const releaseRefreshLock = () => {
    try {
        const raw = localStorage.getItem(REFRESH_LOCK_KEY);
        if (raw && JSON.parse(raw).id === _tabLockId) localStorage.removeItem(REFRESH_LOCK_KEY);
    } catch { /* ignore */ }
};

/** Poll storage while another tab refreshes; resolves the fresh token or null if it stalls/fails. */
const waitForOtherTabRefresh = async (staleToken) => {
    for (let i = 0; i < 32; i++) { // ~8s
        await new Promise(r => setTimeout(r, 250));
        const s = lookInSession("user");
        if (!s) return null; // logged out meanwhile
        try {
            const { access_token } = JSON.parse(s);
            if (access_token && access_token !== staleToken && !isTokenExpiringSoon(access_token)) {
                return access_token;
            }
        } catch { return null; }
        try {
            if (!localStorage.getItem(REFRESH_LOCK_KEY)) return null; // other tab gave up — take over
        } catch { return null; }
    }
    return null;
};

/**
 * Perform the actual token refresh. Shared between the interceptors and the socket layer so we
 * never have two refreshes running concurrently — per browser, not just per tab.
 * Returns the new access_token on success, or throws on failure.
 */
const doRefresh = async () => {
    // Re-read the session first — another tab may already have refreshed while we queued.
    const s0 = lookInSession("user");
    if (!s0) throw new Error("No session");
    let userData = JSON.parse(s0);
    if (userData.access_token && !isTokenExpiringSoon(userData.access_token)) {
        return userData.access_token;
    }
    if (!userData.refresh_token) throw new Error("No refresh token");

    // Another tab is refreshing — wait for its result instead of racing the rotation.
    if (!tryAcquireRefreshLock()) {
        const fresh = await waitForOtherTabRefresh(userData.access_token);
        if (fresh) return fresh;
        const s1 = lookInSession("user");
        if (!s1) throw new Error("No session");
        userData = JSON.parse(s1);
        if (userData.access_token && !isTokenExpiringSoon(userData.access_token)) {
            return userData.access_token;
        }
        // The other tab stalled or failed — refresh ourselves.
    }

    // Heartbeat the lock while the request is in flight so a legitimately slow refresh (timeout +
    // retry can exceed the 10s TTL) can't go stale and let another tab start a competing refresh.
    const heartbeat = setInterval(() => {
        try { localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify({ id: _tabLockId, t: Date.now() })); } catch { /* ignore */ }
    }, REFRESH_LOCK_TTL_MS / 2);

    try {
        const refreshUrl = `${import.meta.env.VITE_SERVER_DOMAIN}api/v1/refresh-token`;
        // Record exactly which refresh token this attempt sends, so we only store the response if the
        // stored token still equals it — otherwise a racing refresher already won and we keep theirs.
        let sentToken = null;
        const post = () => {
            let rt = userData.refresh_token;
            try { rt = JSON.parse(lookInSession("user"))?.refresh_token || rt; } catch { /* keep */ }
            sentToken = rt;
            // Timeout < lock TTL so a black-holed request can't hang the tab (parking every queued
            // request) or outlive the lock. axios timeout rejects with no err.response → retry path.
            return axios.post(refreshUrl, { refresh_token: rt }, { timeout: 8000 });
        };

        let data;
        try {
            ({ data } = await post());
        } catch (err) {
            // Retry once only when the failure was NOT definitive. Definitive = the server answered with
            // a 4xx (401/403 → token truly dead). Transient = no response at all (network blip / timeout,
            // possibly AFTER the server already rotated) OR an explicit 503 (the server was momentarily
            // too contended to win the rotation CAS and asked us to retry). The grace window keeps the
            // previous token valid across the retry, and post() re-reads the freshest stored token.
            const transient = !err.response || err.response.status === 503;
            if (!transient) throw err;
            await new Promise(r => setTimeout(r, 1200));
            ({ data } = await post());
        }

        // The user may have signed out while this was in flight — do NOT resurrect a cleared session.
        const s2 = lookInSession("user");
        if (!s2) throw new Error("No session");
        const current = JSON.parse(s2);

        // Compare-and-swap on store: only adopt our rotated token if the stored refresh token is still
        // the one we sent. If another refresher won in the meantime, keep their (newer) tokens.
        if (current.refresh_token === sentToken) {
            current.access_token = data.access_token;
            if (data.refresh_token) current.refresh_token = data.refresh_token;
            storeInSession("user", JSON.stringify(current));
            return data.access_token;
        }
        // Another refresher already advanced the session — prefer its stored token if still valid.
        if (current.access_token && !isTokenExpiringSoon(current.access_token)) return current.access_token;
        return data.access_token;
    } finally {
        clearInterval(heartbeat);
        releaseRefreshLock();
    }
};

/**
 * Returns a valid (non-expiring) access token, refreshing it first if needed — single-flight,
 * shared with the interceptors. Used by the Socket.IO layer so every connection attempt carries a
 * fresh token. Resolves null when there is no recoverable session.
 */
export const ensureFreshToken = async () => {
    const s = lookInSession("user");
    if (!s) return null;
    let access_token;
    try { ({ access_token } = JSON.parse(s)); } catch { return null; }
    if (access_token && !isTokenExpiringSoon(access_token)) return access_token;

    if (isRefreshing) {
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
            .catch(() => null);
    }
    isRefreshing = true;
    try {
        const token = await doRefresh();
        processQueue(null, token);
        return token;
    } catch (err) {
        processQueue(err, null);
        return null;
    } finally {
        isRefreshing = false;
    }
};

/**
 * Best-effort server-side sign-out: revokes THIS device's refresh session so the tokens can't be
 * used after logout (other devices stay signed in). Fire-and-forget — local cleanup never waits.
 */
export const revokeSessionOnServer = () => {
    try {
        const s = lookInSession("user");
        if (!s) return;
        const { refresh_token, access_token } = JSON.parse(s);
        if (!refresh_token) return;
        // RAW axios, not the `api` instance: sign-out sites clear localStorage synchronously right
        // after this call, but `api`'s request interceptor runs on a later microtask and would read
        // the already-cleared session, sending /logout with no auth. The server self-authenticates on
        // the refresh_token, so this revokes the device's session even if the access token is stale.
        const url = `${import.meta.env.VITE_SERVER_DOMAIN}api/v1/logout`;
        const headers = access_token ? { Authorization: `Bearer ${access_token}` } : {};
        axios.post(url, { refresh_token }, { headers, timeout: 8000 }).catch(() => { /* best-effort */ });
    } catch { /* ignore */ }
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
                processQueue(err, null);
                isRefreshing = false;

                // Only end the session when the refresh endpoint DEFINITIVELY rejected the refresh
                // token (expired/revoked → 401/403). A network blip or server hiccup mid-refresh
                // must NOT nuke a valid session — the next request simply tries again.
                const refreshStatus = err?.response?.status;
                if (refreshStatus === 401 || refreshStatus === 403) {
                    // Flag so React Query's retry policy won't retry a dead session (retrying just
                    // re-hits 401 and re-triggers this redirect/toast). The flag rides on the same
                    // error object that processQueue rejects queued requests with.
                    if (err && typeof err === 'object') err.__sessionExpired = true;
                    removeFromSession("user");
                    showDedupedToast("Session expired. Please log in again.", "session-expired");
                    setTimeout(() => window.location.href = "/signin", 1500);
                } else if (refreshStatus >= 500) {
                    // The refresh itself hit a transient server error (e.g. the refresh endpoint was
                    // momentarily too contended and returned 503). The session is intentionally kept,
                    // but the original request is still failing — surface it so an action like publish
                    // or draft-save doesn't just silently drop its loading spinner with no feedback.
                    // (This branch is inside the 401-retry path, which never falls through to the
                    // generic 5xx handler below.)
                    showDedupedToast("Server error. Please try again later.", "server-error");
                } else if (!refreshStatus) {
                    // No response to the refresh at all (offline / timeout) — same reasoning.
                    showDedupedToast("You're offline. Check your connection.", "network-offline");
                }
                return Promise.reject(err);
            }
        }

        // ── Non-401 error handling ─────────────────────────────────────
        // Use a short cooldown so that when multiple requests fail at once
        // (e.g. device goes offline), only ONE toast is shown — not one per request.
        if (status === 429) {
            showDedupedToast("Too many requests. Please slow down.", "rate-limit");
        } else if (status === 413) {
            // Body too large. The API returns a readable JSON message, but if a proxy (nginx) rejects
            // an extreme payload first it replies with HTML (no parseable .error) — so surface a clean,
            // consistent message here regardless of which layer refused it. Deduped + centralized so the
            // per-call-site catches don't need to (and must not) re-toast it.
            showDedupedToast("This article is too long to save. Please shorten it and try again.", "payload-too-large");
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
