import { describe, it, expect } from 'vitest'
import { queryClient } from './queryClient'

// The retry policy is wired as queries.retry on the shared client. We read it
// back off the client so the test pins the ACTUAL behavior the app runs with,
// not a re-implementation.
describe('queryClient retry policy', () => {
  const retry = queryClient.getDefaultOptions().queries.retry

  it('is a function (not a fixed count)', () => {
    expect(typeof retry).toBe('function')
  })

  it('never retries 4xx client errors', () => {
    expect(retry(0, { response: { status: 400 } })).toBe(false)
    expect(retry(0, { response: { status: 403 } })).toBe(false)
    expect(retry(0, { response: { status: 404 } })).toBe(false)
    expect(retry(0, { response: { status: 422 } })).toBe(false)
  })

  it('retries network errors and 5xx up to 2 times', () => {
    // No response object → treated as a transient network error.
    expect(retry(0, {})).toBe(true)
    expect(retry(1, {})).toBe(true)
    expect(retry(2, {})).toBe(false)

    expect(retry(0, { response: { status: 500 } })).toBe(true)
    expect(retry(1, { response: { status: 503 } })).toBe(true)
    expect(retry(2, { response: { status: 500 } })).toBe(false)
  })

  it('never retries a dead session, even if it also looks like a 5xx/network error', () => {
    expect(retry(0, { __sessionExpired: true })).toBe(false)
    expect(retry(0, { __sessionExpired: true, response: { status: 500 } })).toBe(false)
  })

  it('uses an exponential, capped retry delay', () => {
    const retryDelay = queryClient.getDefaultOptions().queries.retryDelay
    expect(retryDelay(0)).toBe(1000)
    expect(retryDelay(1)).toBe(2000)
    expect(retryDelay(2)).toBe(4000)
    expect(retryDelay(100)).toBe(30_000) // capped
  })
})
