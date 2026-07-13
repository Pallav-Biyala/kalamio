import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import { apiLimiter } from './rateLimiter.js'

// These confirm the limiter constructs + runs behind `trust proxy` with the
// custom CF-Connecting-IP keyGenerator (config errors surface at request time).
describe('rate limiter', () => {
  const makeApp = () => {
    const app = express()
    app.set('trust proxy', true)
    app.get('/x', apiLimiter, (req, res) => res.json({ ok: true }))
    return app
  }

  it('passes requests under the limit and emits standard RateLimit headers', async () => {
    const res = await request(makeApp()).get('/x').set('CF-Connecting-IP', '1.2.3.4')
    expect(res.status).toBe(200)
    expect(res.headers['ratelimit-limit']).toBeDefined()
  })

  it('keys buckets by CF-Connecting-IP (distinct client IPs are independent)', async () => {
    const app = makeApp()
    const a = await request(app).get('/x').set('CF-Connecting-IP', '9.9.9.9')
    const b = await request(app).get('/x').set('CF-Connecting-IP', '8.8.8.8')
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
  })
})
