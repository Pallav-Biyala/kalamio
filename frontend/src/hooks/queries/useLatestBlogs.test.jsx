import { describe, it, expect } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '../../test/msw/server'
import { API } from '../../test/msw/handlers'
import useLatestBlogs from './useLatestBlogs'

// This hook does NOT read UserContext, so no UserContext provider is needed.
// It uses the REAL api instance, so MSW intercepts the actual HTTP calls and
// exercises the axios interceptors end-to-end.

const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } })

const makeWrapper = (client) =>
  function Wrapper({ children }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }

// A page-aware /latest-blogs handler plus a /all-latest-blogs-count handler.
// `pages` maps page number → the blogs array returned for that page.
const seedFeedHandlers = (pages, totalDocs) => {
  let countCalls = 0
  server.use(
    http.post(`${API}/latest-blogs`, async ({ request }) => {
      const { page } = await request.json()
      return HttpResponse.json({ blogs: pages[page] ?? [] })
    }),
    http.post(`${API}/all-latest-blogs-count`, () => {
      countCalls++
      return HttpResponse.json({ totalDocs })
    }),
  )
  return () => countCalls
}

const mkBlog = (id) => ({ _id: id, blog_id: `slug-${id}`, title: `Blog ${id}` })

describe('useLatestBlogs (infinite query, MSW integration)', () => {
  it('first page fetches the count and select() exposes { blogs, totalDocs, hasMore }', async () => {
    const getCountCalls = seedFeedHandlers(
      { 1: [mkBlog('a'), mkBlog('b')] },
      5, // totalDocs > loaded (2) → hasMore true
    )
    const client = makeClient()
    const { result } = renderHook(() => useLatestBlogs(), {
      wrapper: makeWrapper(client),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // select() reshapes the raw {pages,pageParams} into the flattened object.
    expect(result.current.data.blogs.map((b) => b._id)).toEqual(['a', 'b'])
    expect(result.current.data.totalDocs).toBe(5)
    expect(result.current.data.hasMore).toBe(true)

    // The count endpoint is fetched exactly once (on page 1 only).
    expect(getCountCalls()).toBe(1)
    // With more docs than loaded, another page is available.
    expect(result.current.hasNextPage).toBe(true)
  })

  it('getNextPageParam drives fetchNextPage and flattens blogs across pages, then stops when all loaded', async () => {
    const getCountCalls = seedFeedHandlers(
      { 1: [mkBlog('a'), mkBlog('b')], 2: [mkBlog('c')] },
      3, // 2 on page 1 + 1 on page 2 = 3 = totalDocs → no more after page 2
    )
    const client = makeClient()
    const { result } = renderHook(() => useLatestBlogs(), {
      wrapper: makeWrapper(client),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // After page 1: 2 loaded < 3 total → a next page exists.
    expect(result.current.data.blogs).toHaveLength(2)
    expect(result.current.hasNextPage).toBe(true)
    expect(result.current.data.hasMore).toBe(true)

    await act(async () => {
      await result.current.fetchNextPage()
    })

    await waitFor(() =>
      expect(result.current.data.blogs.map((b) => b._id)).toEqual([
        'a',
        'b',
        'c',
      ]),
    )
    // All 3 docs loaded → getNextPageParam returns undefined and hasMore is false.
    expect(result.current.hasNextPage).toBe(false)
    expect(result.current.data.hasMore).toBe(false)
    expect(result.current.data.totalDocs).toBe(3)

    // totalDocs persists from page 1 only — count endpoint not re-hit on page 2.
    expect(getCountCalls()).toBe(1)
  })

  it('reports no next page when the first page already loads every doc', async () => {
    seedFeedHandlers({ 1: [mkBlog('a'), mkBlog('b')] }, 2) // loaded == totalDocs
    const client = makeClient()
    const { result } = renderHook(() => useLatestBlogs(), {
      wrapper: makeWrapper(client),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data.blogs).toHaveLength(2)
    expect(result.current.data.hasMore).toBe(false)
    expect(result.current.hasNextPage).toBe(false)
  })
})
