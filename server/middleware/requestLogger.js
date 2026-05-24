import pinoHttp from 'pino-http';
import crypto from 'crypto';
import logger from '../config/logger.js';

/**
 * HTTP request/response logging middleware.
 *
 * Automatically:
 * - Assigns a unique request ID (X-Request-Id header)
 * - Logs request method, URL, status code, and response time
 * - Attaches req.log for per-request child logger usage in controllers
 *
 * Usage in controllers:
 *   req.log.info({ userId }, 'Fetched user profile');
 */
const requestLogger = pinoHttp({
    logger,

    // Generate unique request ID
    genReqId: (req) => {
        return req.headers['x-request-id'] || crypto.randomUUID();
    },

    // Customize what gets logged per request
    customLogLevel: (req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },

    // Don't log health check spam
    autoLogging: {
        ignore: (req) => req.url === '/health',
    },

    // Add response time header
    customSuccessMessage: (req, res) => {
        return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage: (req, res, err) => {
        return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
    },

    // Serialize only essential request fields (not full headers)
    serializers: {
        req: (req) => ({
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
        }),
        res: (res) => ({
            statusCode: res.statusCode,
        }),
    },
});

export default requestLogger;
