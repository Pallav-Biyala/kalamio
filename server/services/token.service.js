import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AUTH } from '../constants/auth.constants.js';

/**
 * Generates a short-lived access token (15 minutes).
 * Used for authenticating API requests.
 */
export const generateAccessToken = (userId) => {
    return jwt.sign(
        { id: userId },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: AUTH.ACCESS_TOKEN_EXPIRY }
    );
};

/**
 * Generates a long-lived refresh token (30 days).
 * Carries the session id (`sid`) so the server can look up the exact per-device session it belongs
 * to — this is what lets several devices stay signed in independently. Legacy tokens (no sid) are
 * still accepted by the refresh endpoint and migrated on first use.
 */
export const generateRefreshToken = (userId, sid) => {
    return jwt.sign(
        // jti makes every issued token globally unique — without it, two rotations for the same
        // session within the same second would produce byte-identical JWTs (iat/exp have second
        // resolution), collapsing the rotation/grace bookkeeping into one hash.
        { id: userId, ...(sid ? { sid } : {}), jti: crypto.randomUUID() },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: AUTH.REFRESH_TOKEN_EXPIRY }
    );
};

/**
 * Generates both access and refresh tokens as a pair for a given session.
 * Called on successful login, signup verification, OAuth exchange, and token refresh.
 */
export const generateTokenPair = (userId, sid) => {
    return {
        access_token: generateAccessToken(userId),
        refresh_token: generateRefreshToken(userId, sid),
    };
};

/**
 * Verifies a refresh token's JWT signature and returns the decoded payload.
 * Returns null if the token is invalid or expired.
 */
export const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
        return null;
    }
};

/**
 * Verifies an access token's JWT signature and returns the decoded payload, or null.
 * Used by /logout to identify old clients that authenticate with a Bearer access token.
 */
export const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch {
        return null;
    }
};

/**
 * SHA-256 digest used to store refresh tokens at rest. Refresh tokens are high-entropy JWTs (signed
 * with a 512-bit secret), so a fast unsalted digest is the appropriate at-rest protection — bcrypt
 * here would only add ~100ms of CPU per compare with no security gain, and the refresh endpoint may
 * compare against several session entries.
 */
export const hashToken = (token) =>
    crypto.createHash('sha256').update(token).digest('hex');

/** Constant-time equality for two hex digests (avoids timing side-channels on token compare). */
export const safeEqual = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};
