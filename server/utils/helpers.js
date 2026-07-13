import { nanoid } from 'nanoid';
import User from '../Schema/User.js';

export const generateUsername = async (email) => {
    let username = email.split("@")[0];

    let isUsernameExists = await User.exists({ "personal_info.username": username }).then((result) => result)

    isUsernameExists ? username += nanoid().substring(0, 5) : "";

    return username;
};

// Escape special regex characters to prevent ReDoS
export const escapeRegex = (str) => {
    if (!str) return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Resolve the real client IP behind Cloudflare + nginx. Cloudflare sets
 * `CF-Connecting-IP` and overwrites any client-supplied value, so it can't be
 * spoofed; fall back to Express's req.ip (which needs `trust proxy`) locally.
 */
export const getClientIp = (req) =>
    req.headers['cf-connecting-ip'] || req.ip || req.socket?.remoteAddress || 'unknown';
