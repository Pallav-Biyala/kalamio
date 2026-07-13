import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Isolate the hook: mock the App module (so we don't import the whole app tree
// just for UserContext) and the axios instance (so we control resolve/reject).
vi.mock('../../App', async () => {
  const { createContext } = await import('react')
  return { UserContext: createContext({}) }
})
vi.mock('../../common/api', () => ({
  default: { post: vi.fn() },
}))

import api from '../../common/api'
import { UserContext } from '../../App'
import { queryKeys } from '../../common/queryKeys'
import { useLikeBlog } from './useLikeBlog'

// ── Helpers ─────────────────────────────────────────────────────────

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

const makeWrapper = (client) =>
  function Wrapper({ children }) {
    return (
      <QueryClientProvider client={client}>
        <UserContext.Provider value={{ userAuth: { access_token: 'test' }, setUserAuth: () => {} }}>
          {children}
        </UserContext.Provider>
      </QueryClientProvider>
    )
  }

// A promise we resolve/reject by hand, so a test can observe the optimistic
// state (applied by the async onMutate) before the request settles.
const deferred = () => {
  let resolve, reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const blog = (id, slug, likes) => ({
  _id: id,
  blog_id: slug,
  activity: { total_likes: likes, total_comments: 0 },
})

// Seed the "latest" feed with the infinite-query cache shape the hook patches.
const seedFeed = (client, blogs) =>
  client.setQueryData(queryKeys.blogs.latest(), {
    pages: [{ blogs, page: 1, totalDocs: blogs.length }],
    pageParams: [1],
  })

const feedLikes = (client, id) =>
  client
    .getQueryData(queryKeys.blogs.latest())
    .pages[0].blogs.find((b) => b._id === id).activity.total_likes

describe('useLikeBlog', () => {
  it('optimistically increments the count everywhere and marks liked, keeping it on success', async () => {
    const client = makeClient()
    seedFeed(client, [blog('A', 'a-slug', 5)])
    client.setQueryData(queryKeys.blogs.detail('a-slug'), blog('A', 'a-slug', 5))
    client.setQueryData(queryKeys.likes.status('A'), false)
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useLikeBlog('a-slug'), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ _id: 'A', isLikedByUser: false }))

    // onMutate is async (awaits cancelQueries) — wait for the optimistic patch.
    await waitFor(() => expect(feedLikes(client, 'A')).toBe(6))
    expect(client.getQueryData(queryKeys.likes.status('A'))).toBe(true)
    expect(client.getQueryData(queryKeys.blogs.detail('a-slug')).activity.total_likes).toBe(6)

    await act(async () => req.resolve({ data: { liked_by_user: true } }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Server confirmed — the optimistic values remain.
    expect(feedLikes(client, 'A')).toBe(6)
    expect(client.getQueryData(queryKeys.likes.status('A'))).toBe(true)
  })

  it('decrements when unliking', async () => {
    const client = makeClient()
    seedFeed(client, [blog('A', 'a-slug', 5)])
    client.setQueryData(queryKeys.likes.status('A'), true)
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useLikeBlog('a-slug'), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ _id: 'A', isLikedByUser: true }))

    await waitFor(() => expect(feedLikes(client, 'A')).toBe(4))
    expect(client.getQueryData(queryKeys.likes.status('A'))).toBe(false)

    await act(async () => req.resolve({ data: { liked_by_user: false } }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(feedLikes(client, 'A')).toBe(4)
  })

  it('rolls back the count and like status on error (inverse delta)', async () => {
    const client = makeClient()
    seedFeed(client, [blog('A', 'a-slug', 5)])
    client.setQueryData(queryKeys.likes.status('A'), false)
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useLikeBlog('a-slug'), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ _id: 'A', isLikedByUser: false }))

    await waitFor(() => expect(feedLikes(client, 'A')).toBe(6)) // optimistic

    await act(async () => req.reject(new Error('network down')))
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(feedLikes(client, 'A')).toBe(5) // rolled back
    expect(client.getQueryData(queryKeys.likes.status('A'))).toBe(false)
  })

  it('a failed like on one blog does not wipe a concurrent like on another (round-2 regression)', async () => {
    const client = makeClient()
    seedFeed(client, [blog('A', 'a-slug', 5), blog('B', 'b-slug', 8)])
    client.setQueryData(queryKeys.likes.status('A'), false)
    client.setQueryData(queryKeys.likes.status('B'), false)

    // Deferred, keyed by blog id so this is robust to call ordering.
    const reqA = deferred()
    const reqB = deferred()
    api.post.mockImplementation((_url, body) => (body._id === 'A' ? reqA.promise : reqB.promise))

    const wrapper = makeWrapper(client)
    const { result: rA } = renderHook(() => useLikeBlog('a-slug'), { wrapper })
    const { result: rB } = renderHook(() => useLikeBlog('b-slug'), { wrapper })

    act(() => rA.current.mutate({ _id: 'A', isLikedByUser: false }))
    act(() => rB.current.mutate({ _id: 'B', isLikedByUser: false }))

    // Both optimistically applied.
    await waitFor(() => expect(feedLikes(client, 'A')).toBe(6))
    await waitFor(() => expect(feedLikes(client, 'B')).toBe(9))

    // A fails while B succeeds.
    await act(async () => {
      reqA.reject(new Error('fail A'))
      reqB.resolve({ data: {} })
    })
    await waitFor(() => expect(rA.current.isError).toBe(true))
    await waitFor(() => expect(rB.current.isSuccess).toBe(true))

    // A rolled back to 5; B's optimistic +1 survives at 9 (not wiped by A's rollback).
    expect(feedLikes(client, 'A')).toBe(5)
    expect(feedLikes(client, 'B')).toBe(9)
    expect(client.getQueryData(queryKeys.likes.status('A'))).toBe(false)
    expect(client.getQueryData(queryKeys.likes.status('B'))).toBe(true)
  })
})
