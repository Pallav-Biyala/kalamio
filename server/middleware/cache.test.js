import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Mock the redis layer so the middleware is tested in isolation.
vi.mock('../config/redis.js', () => ({
  isCacheEnabled: vi.fn(() => true),
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheAddToTag: vi.fn(),
  cacheInvalidateTags: vi.fn(),
}))

import {
  isCacheEnabled,
  cacheGet,
  cacheSet,
  cacheAddToTag,
  cacheInvalidateTags,
} from '../config/redis.js'
import { cacheResponse, invalidateCacheOnWrite } from './cache.js'

// Build an app whose handler is a spy, so we can assert whether it ran.
const makeApp = (opts, handler) => {
  const app = express()
  app.use(express.json())
  app.post('/feed', cacheResponse(opts), handler)
  return app
}

beforeEach(() => {
  isCacheEnabled.mockReturnValue(true)
  cacheGet.mockResolvedValue(null)
  cacheSet.mockResolvedValue(undefined)
})

describe('cacheResponse middleware', () => {
  it('is a transparent no-op when caching is disabled', async () => {
    isCacheEnabled.mockReturnValue(false)
    const handler = vi.fn((req, res) => res.json({ live: true }))

    const res = await request(makeApp({ ttl: 60 }, handler)).post('/feed').send({ page: 1 })

    expect(res.body).toEqual({ live: true })
    expect(handler).toHaveBeenCalledOnce()
    expect(res.headers['x-cache']).toBeUndefined()
    expect(cacheGet).not.toHaveBeenCalled()
  })

  it('serves the cached body on a HIT without running the handler', async () => {
    cacheGet.mockResolvedValue({ cached: true, page: 1 })
    const handler = vi.fn((req, res) => res.json({ live: true }))

    const res = await request(makeApp({ ttl: 60 }, handler)).post('/feed').send({ page: 1 })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ cached: true, page: 1 })
    expect(res.headers['x-cache']).toBe('HIT')
    expect(handler).not.toHaveBeenCalled()
  })

  it('runs the handler on a MISS and caches its 2xx JSON with the TTL', async () => {
    cacheGet.mockResolvedValue(null)
    const handler = vi.fn((req, res) => res.json({ blogs: ['a', 'b'] }))

    const res = await request(makeApp({ ttl: 120 }, handler)).post('/feed').send({ page: 2 })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ blogs: ['a', 'b'] })
    expect(res.headers['x-cache']).toBe('MISS')
    expect(handler).toHaveBeenCalledOnce()
    expect(cacheSet).toHaveBeenCalledWith(
      expect.stringContaining('cache:POST:/feed:'),
      { blogs: ['a', 'b'] },
      120,
    )
  })

  it('does not cache non-2xx responses', async () => {
    cacheGet.mockResolvedValue(null)
    const handler = vi.fn((req, res) => res.status(404).json({ error: 'not found' }))

    await request(makeApp({ ttl: 60 }, handler)).post('/feed').send({ page: 9 })

    expect(cacheSet).not.toHaveBeenCalled()
  })

  it('registers the cache key under its tags on a MISS', async () => {
    cacheGet.mockResolvedValue(null)
    const handler = (req, res) => res.json({ ok: true })

    await request(makeApp({ ttl: 60, tags: ['blogs'] }, handler)).post('/feed').send({ page: 1 })

    expect(cacheAddToTag).toHaveBeenCalledWith('blogs', expect.stringContaining('cache:POST:/feed:'))
  })

  it('sets a public, edge-capped Cache-Control on a GET (for the CDN)', async () => {
    cacheGet.mockResolvedValue(null)
    const app = express()
    app.get('/trending', cacheResponse({ ttl: 300 }), (req, res) => res.json({ ok: true }))

    const res = await request(app).get('/trending')

    expect(res.headers['cache-control']).toContain('public')
    expect(res.headers['cache-control']).toContain('s-maxage=60') // capped from ttl 300
  })

  it('does not set a public Cache-Control on a POST read', async () => {
    cacheGet.mockResolvedValue(null)
    const handler = (req, res) => res.json({ ok: true })

    const res = await request(makeApp({ ttl: 60 }, handler)).post('/feed').send({ page: 1 })

    expect(res.headers['cache-control'] || '').not.toContain('public')
  })

  it('keys distinct request bodies to distinct cache entries', async () => {
    const handler = (req, res) => res.json({ ok: true })
    const app = makeApp({ ttl: 60 }, handler)

    await request(app).post('/feed').send({ page: 1 })
    await request(app).post('/feed').send({ page: 2 })

    const key1 = cacheGet.mock.calls[0][0]
    const key2 = cacheGet.mock.calls[1][0]
    expect(key1).not.toBe(key2)
  })

  it('produces the same key regardless of body key order', async () => {
    const handler = (req, res) => res.json({ ok: true })
    const app = makeApp({ ttl: 60 }, handler)

    await request(app).post('/feed').send({ page: 1, tag: 'ai' })
    await request(app).post('/feed').send({ tag: 'ai', page: 1 })

    expect(cacheGet.mock.calls[0][0]).toBe(cacheGet.mock.calls[1][0])
  })
})

describe('invalidateCacheOnWrite middleware', () => {
  const makeWriteApp = (opts, handler) => {
    const app = express()
    app.use(express.json())
    app.post('/write', invalidateCacheOnWrite(['blogs'], opts), handler)
    return app
  }

  it('invalidates the tags after a successful (2xx) write', async () => {
    const handler = (req, res) => res.status(200).json({ id: 'abc' })
    await request(makeWriteApp({}, handler)).post('/write').send({ draft: false })
    expect(cacheInvalidateTags).toHaveBeenCalledWith(['blogs'])
  })

  it('skips invalidation when `unless` matches (e.g. draft autosave)', async () => {
    const handler = (req, res) => res.status(200).json({ id: 'abc' })
    const opts = { unless: (req) => req.body?.draft === true }
    await request(makeWriteApp(opts, handler)).post('/write').send({ draft: true })
    expect(cacheInvalidateTags).not.toHaveBeenCalled()
  })

  it('still invalidates when `unless` does not match (publish)', async () => {
    const handler = (req, res) => res.status(200).json({ id: 'abc' })
    const opts = { unless: (req) => req.body?.draft === true }
    await request(makeWriteApp(opts, handler)).post('/write').send({ draft: false })
    expect(cacheInvalidateTags).toHaveBeenCalledWith(['blogs'])
  })

  it('does not invalidate on a non-2xx response', async () => {
    const handler = (req, res) => res.status(403).json({ error: 'no permission' })
    await request(makeWriteApp({}, handler)).post('/write').send({ draft: false })
    expect(cacheInvalidateTags).not.toHaveBeenCalled()
  })

  it('supports dynamic tags computed from the request', async () => {
    const tagsFn = (req) => (req.body?.publication ? ['blogs', 'publications'] : ['blogs'])
    const app = express()
    app.use(express.json())
    app.post('/w', invalidateCacheOnWrite(tagsFn), (req, res) => res.status(200).json({ ok: true }))

    await request(app).post('/w').send({ publication: 'pub-1' })
    expect(cacheInvalidateTags).toHaveBeenCalledWith(['blogs', 'publications'])

    cacheInvalidateTags.mockClear()
    await request(app).post('/w').send({})
    expect(cacheInvalidateTags).toHaveBeenCalledWith(['blogs'])
  })

  it('is a transparent no-op when caching is disabled', async () => {
    isCacheEnabled.mockReturnValue(false)
    const handler = vi.fn((req, res) => res.status(200).json({ id: 'abc' }))
    await request(makeWriteApp({}, handler)).post('/write').send({ draft: false })
    expect(handler).toHaveBeenCalledOnce()
    expect(cacheInvalidateTags).not.toHaveBeenCalled()
  })
})
