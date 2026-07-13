import { describe, it, expect, afterEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import originGuard from './originGuard.js'

const makeApp = () => {
  const app = express()
  app.use(originGuard)
  app.get('/health', (req, res) => res.json({ ok: true }))
  app.get('/socket.io/', (req, res) => res.json({ ws: true }))
  app.post('/api/v1/thing', (req, res) => res.json({ data: 1 }))
  return app
}

afterEach(() => vi.unstubAllEnvs())

describe('originGuard', () => {
  it('is a transparent no-op when the secret is unset', async () => {
    const res = await request(makeApp()).post('/api/v1/thing')
    expect(res.status).toBe(200)
  })

  it('rejects requests without the secret header when configured', async () => {
    vi.stubEnv('CLOUDFLARE_ORIGIN_SECRET', 's3cr3t')
    const res = await request(makeApp()).post('/api/v1/thing')
    expect(res.status).toBe(403)
  })

  it('allows requests carrying the correct secret header', async () => {
    vi.stubEnv('CLOUDFLARE_ORIGIN_SECRET', 's3cr3t')
    const res = await request(makeApp()).post('/api/v1/thing').set('X-Origin-Secret', 's3cr3t')
    expect(res.status).toBe(200)
  })

  it('rejects a wrong secret', async () => {
    vi.stubEnv('CLOUDFLARE_ORIGIN_SECRET', 's3cr3t')
    const res = await request(makeApp()).post('/api/v1/thing').set('X-Origin-Secret', 'nope')
    expect(res.status).toBe(403)
  })

  it('always exempts /health and /socket.io (probes + realtime keep working)', async () => {
    vi.stubEnv('CLOUDFLARE_ORIGIN_SECRET', 's3cr3t')
    expect((await request(makeApp()).get('/health')).status).toBe(200)
    expect((await request(makeApp()).get('/socket.io/')).status).toBe(200)
  })
})
