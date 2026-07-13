import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './msw/server'

// ── MSW lifecycle ───────────────────────────────────────────────────
// Start the interception server once, reset any per-test handler overrides
// between tests, and tear it down at the end. `onUnhandledRequest: 'error'`
// makes a missing mock a hard failure so tests can't silently hit the network.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
