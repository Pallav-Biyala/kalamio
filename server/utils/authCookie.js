import { AUTH } from '../constants/auth.constants.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const REFRESH_COOKIE = 'refresh_token';

// Refresh-token cookie attributes.
// - httpOnly: JS (and therefore XSS) can never read it — the whole point of this migration.
// - secure: only over HTTPS in prod/deployed; off for local dev (http://localhost).
// - sameSite 'lax': the SPA and the API are same-origin in every deployed env (kalamio.com /
//   dev.kalamio.com serve both the app and, via the nginx proxy, /api), and same-site on localhost —
//   so Lax always sends it on our own requests while blocking cross-site CSRF. Only /refresh-token and
//   /logout ever read it.
// - path '/api/v1': rides API calls only (not the SPA/asset requests); covers BOTH /refresh-token and
//   /logout so sign-out can revoke the exact device session.
// - maxAge = refresh TTL so the session survives browser restarts; every rotation re-sets it.
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // matches AUTH.REFRESH_TOKEN_EXPIRY ('30d')

const baseCookieOptions = {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    path: '/api/v1',
};

export const setRefreshCookie = (res, token) => {
    res.cookie(REFRESH_COOKIE, token, { ...baseCookieOptions, maxAge: REFRESH_TTL_MS });
};

export const clearRefreshCookie = (res) => {
    // clearCookie must reuse the same name/path (and attributes) or the browser won't match+delete it.
    res.clearCookie(REFRESH_COOKIE, baseCookieOptions);
};

/**
 * The refresh token for this request: the httpOnly cookie first (the new source of truth), then the
 * JSON body. The body path keeps OLD clients working and lets a pre-cookie session bootstrap-migrate
 * on its first refresh (it sends its localStorage token once; we set the cookie and it stops).
 */
export const readRefreshToken = (req) =>
    readCookieHeader(req, REFRESH_COOKIE) || (req.body && req.body.refresh_token) || null;

/**
 * New clients send `X-Refresh-Transport: cookie`. When present we do NOT echo the refresh token in the
 * JSON body — it lives only in the httpOnly cookie (truly httpOnly). Old clients omit the header and
 * still receive the body token, so a mid-rollout deploy never logs anyone out.
 */
export const usesCookieTransport = (req) => req.get('X-Refresh-Transport') === 'cookie';

/** Returns `token` for legacy clients and `undefined` (→ omitted by res.json) for cookie clients. */
export const bodyRefreshToken = (req, token) => (usesCookieTransport(req) ? undefined : token);

// Minimal single-cookie reader — avoids pulling in cookie-parser (and its audit surface) for one value.
function readCookieHeader(req, name) {
    const header = req.headers && req.headers.cookie;
    if (!header) return null;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        if (part.slice(0, eq).trim() === name) {
            try { return decodeURIComponent(part.slice(eq + 1).trim()); }
            catch { return part.slice(eq + 1).trim(); }
        }
    }
    return null;
}
