import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import express from 'express'

vi.mock('../Schema/Post.js', () => ({ default: { find: vi.fn(), distinct: vi.fn() } }))
vi.mock('../Schema/User.js', () => ({ default: { find: vi.fn() } }))
vi.mock('../Schema/Publication.js', () => ({ default: { find: vi.fn() } }))

import Post from '../Schema/Post.js'
import User from '../Schema/User.js'
import Publication from '../Schema/Publication.js'
import sitemapRoutes from '../routes/sitemap.routes.js'
import { buildSitemap } from './sitemap.controller.js'

// Chainable Mongoose find() mock: .select().sort().limit().lean() → result.
const findChain = (result) => {
  const q = {}
  q.select = vi.fn(() => q)
  q.sort = vi.fn(() => q)
  q.limit = vi.fn(() => q)
  q.lean = vi.fn(() => Promise.resolve(result))
  return q
}

const makeApp = () => {
  const app = express()
  app.use('/api/v1', sitemapRoutes)
  return app
}

describe('buildSitemap (pure)', () => {
  it('produces a valid urlset with the home URL plus per-entity entries', () => {
    const xml = buildSitemap({
      blogs: [{ blog_id: 'a', publishedAt: '2026-01-01T00:00:00.000Z' }],
      users: [{ personal_info: { username: 'u' }, updatedAt: '2026-02-01T00:00:00.000Z' }],
      publications: [{ slug: 's' }],
    })
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<loc>https://kalamio.com/</loc>')
    expect(xml).toContain('<loc>https://kalamio.com/blog/a</loc>')
    expect(xml).toContain('<loc>https://kalamio.com/user/u</loc>')
    expect(xml).toContain('<loc>https://kalamio.com/publication/s</loc>')
    expect(xml.trim().endsWith('</urlset>')).toBe(true)
  })

  it('uses updatedAt for lastmod, falling back to publishedAt', () => {
    const withUpdated = buildSitemap({
      blogs: [{ blog_id: 'a', publishedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z' }],
    })
    expect(withUpdated).toContain('<lastmod>2026-05-01T00:00:00.000Z</lastmod>')
    const withoutUpdated = buildSitemap({
      blogs: [{ blog_id: 'b', publishedAt: '2026-01-01T00:00:00.000Z' }],
    })
    expect(withoutUpdated).toContain('<lastmod>2026-01-01T00:00:00.000Z</lastmod>')
  })

  it('returns just the home URL for empty input', () => {
    const xml = buildSitemap({})
    expect((xml.match(/<url>/g) || []).length).toBe(1)
    expect(xml).toContain('<loc>https://kalamio.com/</loc>')
  })

  it('skips entities missing their id and XML-escapes the loc', () => {
    const xml = buildSitemap({
      blogs: [{}, { blog_id: 'ok&x' }],
      users: [{ personal_info: {} }],
    })
    expect((xml.match(/\/blog\//g) || []).length).toBe(1) // the id-less blog is skipped
    expect((xml.match(/\/user\//g) || []).length).toBe(0) // the username-less user is skipped
    expect(xml).toContain('/blog/ok&amp;x</loc>')
  })
})

describe('sitemap endpoint — GET /api/v1/sitemap.xml', () => {
  it('serves XML of published posts, publications, and publishing authors', async () => {
    Post.find.mockReturnValue(
      findChain([{ blog_id: 'p1', publishedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' }]),
    )
    Post.distinct.mockResolvedValue(['authorId1'])
    Publication.find.mockReturnValue(findChain([{ slug: 'my-pub', updatedAt: '2026-01-01T00:00:00.000Z' }]))
    User.find.mockReturnValue(findChain([{ personal_info: { username: 'ada' }, updatedAt: '2026-03-01T00:00:00.000Z' }]))

    const res = await request(makeApp()).get('/api/v1/sitemap.xml')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/xml/)
    expect(res.headers['cache-control']).toContain('max-age')
    expect(res.text).toContain('<loc>https://kalamio.com/</loc>')
    expect(res.text).toContain('<loc>https://kalamio.com/blog/p1</loc>')
    expect(res.text).toContain('<loc>https://kalamio.com/user/ada</loc>')
    expect(res.text).toContain('<loc>https://kalamio.com/publication/my-pub</loc>')
    expect(res.text).toContain('<lastmod>2026-02-01T00:00:00.000Z</lastmod>') // blog uses updatedAt

    // Only published posts, only authors who published.
    expect(Post.find).toHaveBeenCalledWith({ draft: false })
    expect(Post.distinct).toHaveBeenCalledWith('author', { draft: false })
    expect(User.find).toHaveBeenCalledWith({ _id: { $in: ['authorId1'] } })
  })

  it('never 500s — returns a minimal valid sitemap on a DB error', async () => {
    Post.find.mockImplementation(() => {
      throw new Error('db down')
    })
    const res = await request(makeApp()).get('/api/v1/sitemap.xml')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/xml/)
    expect(res.text).toContain('<urlset')
    expect(res.text).toContain('<loc>https://kalamio.com/</loc>')
  })
})
