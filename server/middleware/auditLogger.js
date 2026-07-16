import logger from '../config/logger.js';

/**
 * Audit logger for security-sensitive operations.
 *
 * Logs to a dedicated 'audit' child logger for easy filtering
 * in log aggregation (e.g., Cloud Logging filter: jsonPayload.audit=true).
 *
 * Usage:
 *   audit.log(req, 'LOGIN_SUCCESS', { email: 'user@example.com' });
 *   audit.log(req, 'PASSWORD_CHANGED', { userId: '123' });
 */
const auditLogger = logger.child({ audit: true });

const AUDIT_EVENTS = {
    // Auth
    LOGIN_SUCCESS: 'info',
    LOGIN_FAILED: 'warn',
    SIGNUP: 'info',
    LOGOUT: 'info',
    PASSWORD_CHANGED: 'info',
    PASSWORD_RESET: 'info',
    EMAIL_VERIFIED: 'info',
    OAUTH_LOGIN: 'info',
    TOKEN_REFRESHED: 'info',
    REFRESH_TOKEN_REUSE: 'warn',   // rotated-out refresh token replayed → session revoked (theft signal)
    LEGACY_REFRESH_MIGRATED: 'info',
    // Content
    BLOG_PUBLISHED: 'info',
    BLOG_DELETED: 'info',
    COMMENT_DELETED: 'info',
    // Account
    PROFILE_UPDATED: 'info',
    ACCOUNT_DELETED: 'warn',
    // Admin
    RATE_LIMIT_HIT: 'warn',
};

const audit = {
    /**
     * Log an audit event.
     *
     * @param {import('express').Request} req - Express request (for IP, user, request ID)
     * @param {string} event - Audit event name (e.g., 'LOGIN_SUCCESS')
     * @param {object} details - Additional context
     */
    log(req, event, details = {}) {
        const level = AUDIT_EVENTS[event] || 'info';
        const payload = {
            event,
            userId: req.user || null,
            ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown',
            ...details,
        };

        auditLogger[level](payload, `AUDIT: ${event}`);
    },
};

export default audit;
