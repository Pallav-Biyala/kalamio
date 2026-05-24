import rateLimit from 'express-rate-limit';

/**
 * Rate limiters for different route categories.
 * Each has different thresholds based on sensitivity.
 */

// Strict — login, signup, password reset (brute-force protection)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15,                   // 15 attempts per window
    message: { error: 'Too many auth attempts. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Medium — OTP, email verification (prevent spam)
export const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5,                   // 5 OTP requests per window
    message: { error: 'Too many OTP requests. Please try again after 5 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// General API — for all other authenticated routes
export const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100,                  // 100 requests per minute
    message: { error: 'Too many requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Upload — file upload rate limit
export const uploadLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10,                   // 10 uploads per minute
    message: { error: 'Too many uploads. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
