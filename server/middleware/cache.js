import crypto from 'crypto';
import {
  cacheGet,
  cacheSet,
  cacheAddToTag,
  cacheInvalidateTags,
  isCacheEnabled,
} from '../config/redis.js';

// Deterministic deep-sort so {a,b} and {b,a} bodies produce the same key.
const sortDeep = (value) => {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, k) => {
        acc[k] = sortDeep(value[k]);
        return acc;
      }, {});
  }
  return value;
};

/**
 * Build a stable cache key from the request. These read endpoints are POSTs
 * whose body (page, query, tag…) is the real variable, so the key hashes the
 * body. Public/non-personalized routes only — do NOT apply to per-user data.
 */
const buildKey = (req) => {
  const path = (req.baseUrl || '') + req.path;
  const body = req.body;
  const hasBody = body && typeof body === 'object' && Object.keys(body).length > 0;
  if (!hasBody) return `cache:${req.method}:${path}`;
  const hash = crypto
    .createHash('sha1')
    .update(JSON.stringify(sortDeep(body)))
    .digest('hex')
    .slice(0, 16);
  return `cache:${req.method}:${path}:${hash}`;
};

/**
 * Response-caching middleware for public, non-personalized read endpoints.
 *
 * On a hit, serves the cached JSON and skips the handler entirely. On a miss,
 * runs the handler and caches its 2xx JSON for `ttl` seconds. If Redis is
 * disabled/unreachable it's a transparent no-op (see config/redis.js).
 *
 * @param {{ ttl?: number, tags?: string[], key?: (req) => string }} opts
 */
// Cap the CDN edge TTL regardless of the (longer) origin TTL, so Cloudflare —
// which we can't purge on write — never serves a public read staler than this.
const EDGE_S_MAXAGE_CAP = 60;

export const cacheResponse = ({ ttl = 60, tags = [], key } = {}) =>
  async function cacheMiddleware(req, res, next) {
    // Let a CDN (Cloudflare) edge-cache public GETs — independent of the Upstash
    // origin cache. Browsers revalidate (max-age=0); edge staleness is bounded.
    // POSTs aren't edge-cached by CDNs anyway, so leave them on the no-store default.
    if (req.method === 'GET') {
      res.set('Cache-Control', `public, max-age=0, s-maxage=${Math.min(ttl, EDGE_S_MAXAGE_CAP)}`);
    }

    if (!isCacheEnabled()) return next();

    let cacheKey;
    try {
      cacheKey = key ? key(req) : buildKey(req);
    } catch {
      return next(); // never let key-building break the request
    }

    const cached = await cacheGet(cacheKey); // null on miss OR any error
    if (cached != null) {
      res.set('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    res.set('X-Cache', 'MISS');
    const sendJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful responses; writes are fire-and-forget.
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheSet(cacheKey, body, ttl);
        for (const tag of tags) cacheAddToTag(tag, cacheKey);
      }
      return sendJson(body);
    };
    next();
  };

/**
 * Invalidate cached responses under the given tags after a successful write.
 *
 * Wraps res.json so invalidation fires once the handler responds 2xx (i.e. after
 * the DB write committed). `unless(req)` lets a route skip invalidation for
 * writes that don't affect the cached data — e.g. draft autosaves, which never
 * reach the public feed.
 *
 * @param {string[] | ((req) => string[])} tags  Static tags, or a fn of the request
 *   (e.g. only add 'publications' when the post has a publication).
 * @param {{ unless?: (req) => boolean }} [opts]
 */
export const invalidateCacheOnWrite = (tags = [], { unless } = {}) =>
  function invalidateMiddleware(req, res, next) {
    if (!isCacheEnabled()) return next();

    const sendJson = res.json.bind(res);
    res.json = (body) => {
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      const skip = typeof unless === 'function' && unless(req);
      if (ok && !skip) {
        const resolved = typeof tags === 'function' ? tags(req) : tags;
        if (resolved && resolved.length) cacheInvalidateTags(resolved);
      }
      return sendJson(body);
    };
    next();
  };

export default cacheResponse;
