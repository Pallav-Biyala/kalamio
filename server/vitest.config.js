import { defineConfig } from 'vitest/config'

// Server tests run in a Node environment (no DOM). Mongoose models are mocked
// per-test, so tests never touch a real database.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.test.js'],
    exclude: ['node_modules/**'],
    // Reset mock implementations between tests so a throw/return in one test
    // can't leak into the next.
    mockReset: true,
    // Pin the public origin so prerender canonical/og:url are deterministic.
    env: { FRONTEND_URL: 'https://kalamio.com' },
  },
})
