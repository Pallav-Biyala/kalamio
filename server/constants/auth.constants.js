/**
 * Centralized auth configuration constants.
 * Single source of truth for all auth-related magic numbers.
 */
export const AUTH = {
    // Password hashing
    SALT_ROUNDS: 10,

    // OTP settings
    OTP_LENGTH: 6,
    OTP_MAX_ATTEMPTS: 5,
    OTP_COOLDOWN_MS: 60_000,          // 60 seconds between OTP requests
    OTP_EXPIRY_MS: 10 * 60_000,      // 10 minutes

    // Login attempt protection
    MAX_LOGIN_ATTEMPTS: 5,
    LOGIN_LOCKOUT_MS: 60_000,         // 60-second lockout after max failures

    // OAuth authorization code (single-use, exchanged for tokens)
    AUTH_CODE_EXPIRY_MS: 60_000,      // 60 seconds

    // JWT token expiration
    ACCESS_TOKEN_EXPIRY: '15m',       // 15 minutes — short-lived for security
    REFRESH_TOKEN_EXPIRY: '30d',

    // Refresh sessions (per-device). Each login creates its own session entry, so signing in on a
    // second device no longer logs the first one out.
    MAX_REFRESH_SESSIONS: 8,          // oldest (by last use) is dropped beyond this
    // After a rotation, the PREVIOUS refresh token stays accepted for this window. Absorbs the two
    // real-world races that used to hard-logout users: two tabs refreshing concurrently, and a
    // rotation response lost to a network drop (client retries with the old token).
    REFRESH_ROTATION_GRACE_MS: 60_000,
    // Compare-and-swap retries when rotating a session under concurrent refreshes. Each concurrent
    // refresh on the same token needs one CAS "win" to advance; a burst of N contends for N rounds, so
    // the budget must comfortably exceed realistic concurrency (the client's cross-tab lock caps this
    // near 1). On exhaustion the endpoint returns a retryable 503 — never a false logout.
    REFRESH_CAS_MAX_RETRIES: 12,
};
