import { http, HttpResponse } from 'msw'

// Base URL mirrors api.js: VITE_SERVER_DOMAIN (set in vitest.config.js) + 'api/v1'.
export const API = 'http://localhost:8080/api/v1'

// Default happy-path handlers. Individual tests can override per-test with
// server.use(...) — see src/test/msw/server.js and the resetHandlers in setup.
export const handlers = [
  // Like status is fetched in batches (DataLoader) via /batch-isliked.
  http.post(`${API}/batch-isliked`, async ({ request }) => {
    const { blog_ids } = await request.json()
    return HttpResponse.json({ likedBlogs: blog_ids ?? [] })
  }),
  http.post(`${API}/like-blog`, () => HttpResponse.json({ liked_by_user: true })),
]
