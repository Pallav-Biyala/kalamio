import { http, HttpResponse } from 'msw'

// Base URL mirrors api.js: VITE_SERVER_DOMAIN (set in vitest.config.js) + 'api/v1'.
export const API = 'http://localhost:8080/api/v1'

// Default happy-path handlers. Individual tests can override per-test with
// server.use(...) — see src/test/msw/server.js and the resetHandlers in setup.
export const handlers = [
  http.post(`${API}/isliked-by-user`, () => HttpResponse.json({ result: true })),
  http.post(`${API}/like-blog`, () => HttpResponse.json({ liked_by_user: true })),
]
