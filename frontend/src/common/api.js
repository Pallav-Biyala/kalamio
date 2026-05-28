import axios from 'axios';
import { lookInSession, storeInSession, removeFromSession } from './session';
import toast from 'react-hot-toast';

const api = axios.create({
    baseURL: import.meta.env.VITE_SERVER_DOMAIN + 'api/v1',
});

// Auto-attach auth token from session
api.interceptors.request.use((config) => {
    const userSession = lookInSession("user");
    if (userSession) {
        const { access_token } = JSON.parse(userSession);
        if (access_token) {
            config.headers.Authorization = `Bearer ${access_token}`;
        }
    }
    return config;
});

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

// Global error handling and transparent token refresh
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
            console.log('[TokenRefresh] 401 received for:', originalRequest.url);
            console.log('[TokenRefresh] isRefreshing:', isRefreshing, '| queueLength:', failedQueue.length);

            // If already refreshing, queue the request
            if (isRefreshing) {
                console.log('[TokenRefresh] Queuing request:', originalRequest.url);
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

            const userSession = lookInSession("user");
            console.log('[TokenRefresh] Session exists:', !!userSession);

            if (userSession) {
                const userData = JSON.parse(userSession);
                const { refresh_token } = userData;
                console.log('[TokenRefresh] refresh_token exists:', !!refresh_token);
                console.log('[TokenRefresh] refresh_token preview:', refresh_token?.substring(0, 20) + '...');

                if (refresh_token) {
                    try {
                        const refreshUrl = `${import.meta.env.VITE_SERVER_DOMAIN}api/v1/refresh-token`;
                        console.log('[TokenRefresh] Calling:', refreshUrl);

                        const { data } = await axios.post(refreshUrl, { refresh_token });
                        console.log('[TokenRefresh] ✅ Success! New access_token received');

                        // Update session with new tokens
                        userData.access_token = data.access_token;
                        if (data.refresh_token) userData.refresh_token = data.refresh_token;
                        storeInSession("user", JSON.stringify(userData));

                        processQueue(null, data.access_token);
                        
                        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
                        isRefreshing = false;
                        
                        // Retry original request with new token
                        return api(originalRequest);
                    } catch (err) {
                        console.error('[TokenRefresh] ❌ Refresh FAILED:', err.response?.status, err.response?.data);
                        processQueue(err, null);
                        isRefreshing = false;
                        removeFromSession("user");
                        toast.error("Session expired. Please log in again.");
                        setTimeout(() => window.location.href = "/signin", 1500);
                        return Promise.reject(err);
                    }
                }
            }

            // No session or no refresh token — clear everything and redirect
            console.error('[TokenRefresh] ❌ No session or no refresh_token found');
            isRefreshing = false;
            removeFromSession("user");
            toast.error("Session expired. Please log in again.");
            setTimeout(() => window.location.href = "/signin", 1500);
            return Promise.reject(error);
        }

        // ── Non-401 error handling ─────────────────────────────────────
        if (status === 429) {
            toast.error("Too many requests. Please slow down.");
        } else if (status >= 500) {
            toast.error("Server error. Please try again later.");
        }

        return Promise.reject(error);
    }
);

export default api;
