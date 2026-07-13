import { Redis } from '@upstash/redis';
import logger from './logger.js';

/**
 * Upstash Redis (REST) — used for response caching. The REST client is
 * stateless HTTP, which suits Cloud Run's scale-to-zero / many-instance model
 * (no connection pool to exhaust).
 *
 * Caching is an OPTIONAL optimization: if the env vars aren't set or Redis is
 * unreachable, every helper degrades to a no-op and the API behaves exactly as
 * it did before. None of these functions ever throw.
 */

const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env;

const client =
  UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN })
    : null;

if (client) {
  logger.info('Response caching enabled (Upstash Redis)');
} else {
  logger.warn('UPSTASH_REDIS_REST_* not set — response caching disabled');
}

export const isCacheEnabled = () => client !== null;

/**
 * Read a cached value. Returns the deserialized value, or null on miss / any error.
 */
export const cacheGet = async (key) => {
  if (!client) return null;
  try {
    return await client.get(key);
  } catch (err) {
    logger.warn({ err: err?.message, key }, 'cache read failed');
    return null;
  }
};

/**
 * Write a value with a TTL (seconds). Fire-and-forget: swallows all errors.
 */
export const cacheSet = async (key, value, ttlSeconds) => {
  if (!client) return;
  try {
    await client.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    logger.warn({ err: err?.message, key }, 'cache write failed');
  }
};

// Tag sets outlive the (<= 300s) data entries they track, so an invalidation
// can always find them; they self-expire if no write ever clears them.
const TAG_TTL_SECONDS = 3600;

/**
 * Associate a cache key with a tag (a Redis SET), so all keys under a tag can be
 * invalidated together without SCAN. Fire-and-forget.
 */
export const cacheAddToTag = async (tag, key) => {
  if (!client) return;
  try {
    const setKey = `cache:tag:${tag}`;
    await client.sadd(setKey, key);
    await client.expire(setKey, TAG_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err: err?.message, tag, key }, 'cache tag add failed');
  }
};

/**
 * Delete every cache key registered under the given tags (and the tag sets).
 * Never throws.
 */
export const cacheInvalidateTags = async (tags = []) => {
  if (!client || !tags.length) return;
  try {
    for (const tag of tags) {
      const setKey = `cache:tag:${tag}`;
      const keys = await client.smembers(setKey);
      if (keys && keys.length) {
        await client.del(...keys);
      }
      await client.del(setKey);
    }
  } catch (err) {
    logger.warn({ err: err?.message, tags }, 'cache invalidation failed');
  }
};

export default client;
