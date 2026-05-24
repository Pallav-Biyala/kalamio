/**
 * Global error handler middleware.
 *
 * Differentiates between Mongoose, JWT, and generic errors so clients
 * get meaningful messages without leaking internal details.
 * Must have 4 parameters for Express to recognize it as an error handler.
 */
const errorHandler = (err, req, res, next) => {
    // Default values
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';

    // ── Mongoose validation error (e.g. missing required fields, minlength) ──
    if (err.name === 'ValidationError') {
        statusCode = 400;
        const messages = Object.values(err.errors).map(e => e.message);
        message = messages.join('. ');
    }

    // ── Mongoose duplicate key error (e.g. unique constraint violated) ──
    if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyPattern)?.[0] || 'field';
        message = `Duplicate value for ${field}. This ${field} already exists.`;
    }

    // ── Mongoose CastError (e.g. invalid ObjectId) ──
    if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid ${err.path}: ${err.value}`;
    }

    // ── JWT errors ──
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
    }
    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token has expired';
    }

    // ── Log server errors (don't log client errors in production) ──
    if (statusCode >= 500) {
        console.error(`[Error] ${req.method} ${req.path}:`, err.stack || err.message);
    } else {
        console.warn(`[Warn] ${req.method} ${req.path}: ${message}`);
    }

    // ── Never leak stack traces or internal error details to clients ──
    return res.status(statusCode).json({
        error: statusCode >= 500 ? 'Something went wrong. Please try again later.' : message,
    });
};

export default errorHandler;
