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

    // onMutate applies the optimistic patch synchronously — wait is belt-and-braces.
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

  // ── Regression: the server is the authority ────────────────────────────────
  //
  // The client sends what it BELIEVES the current state is, and that belief is often wrong: the
  // like-status query may still be loading, may be stale (10 min staleTime), or a rapid second
  // click carries the flipped optimistic flag. The server then correctly no-ops — and used to
  // reply without a count, stranding the optimistic +1/-1 on screen (feeds settle with
  // refetchType:'none') until a refresh "reverted" it. Reproduced live against the real API:
  // count 5 -> 5 while the client showed 6.

  it('adopts the server total_likes when our guess was wrong (stale false while already liked)', async () => {
    const client = makeClient()
    seedFeed(client, [blog('A', 'a-slug', 5)])
    client.setQueryData(queryKeys.likes.status('A'), false)
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useLikeBlog('a-slug'), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ _id: 'A', isLikedByUser: false }))

    await waitFor(() => expect(feedLikes(client, 'A')).toBe(6)) // optimistic guess: +1

    // Server: it was already liked, so nothing changed — the real count is still 5.
    await act(async () => req.resolve({ data: { liked_by_user: true, total_likes: 5 } }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(feedLikes(client, 'A')).toBe(5)                                  // corrected, not 6
    expect(client.getQueryData(queryKeys.likes.status('A'))).toBe(true)
  })

  it('adopts the server total_likes on a no-op unlike (stale true while not liked)', async () => {
    const client = makeClient()
    seedFeed(client, [blog('A', 'a-slug', 4)])
    client.setQueryData(queryKeys.likes.status('A'), true)
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useLikeBlog('a-slug'), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ _id: 'A', isLikedByUser: true }))

    await waitFor(() => expect(feedLikes(client, 'A')).toBe(3)) // optimistic guess: -1

    // Server: there was no like to remove — the real count is still 4.
    await act(async () => req.resolve({ data: { liked_by_user: false, total_likes: 4 } }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(feedLikes(client, 'A')).toBe(4)                                  // corrected, not 3
    expect(client.getQueryData(queryKeys.likes.status('A'))).toBe(false)
  })

  it('only corrects the target blog, leaving other blogs untouched', async () => {
    const client = makeClient()
    seedFeed(client, [blog('A', 'a-slug', 5), blog('B', 'b-slug', 9)])
    client.setQueryData(queryKeys.likes.status('A'), false)
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useLikeBlog('a-slug'), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ _id: 'A', isLikedByUser: false }))
    await waitFor(() => expect(feedLikes(client, 'A')).toBe(6))

    await act(async () => req.resolve({ data: { liked_by_user: true, total_likes: 5 } }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(feedLikes(client, 'A')).toBe(5)
    expect(feedLikes(client, 'B')).toBe(9) // untouched
  })

  // ── Regression: rapid like→unlike double-tap under latency ──────────────────
  //
  // The feed-card bug. With a slow /like-blog, the user taps like then unlike a moment later
  // while the first request is still in flight. The old handler dropped the second tap
  // (`if (isPending) return`) AND read a stale render-closure boolean, so the unlike never
  // reached the server: the UI showed unliked while the server stayed liked, and (the feed has
  // no socket echo to reconcile it) the desync survived a refresh. toggle() fixes both — it reads
  // the freshest cache status and never drops a tap.

  it('toggle() reads the fresh optimistic status so a like→unlike double-tap sends both actions', async () => {
    const client = makeClient()
    seedFeed(client, [blog('A', 'a-slug', 5)])
    client.setQueryData(queryKeys.likes.status('A'), false)
    // First request stays pending across the second tap (the latency window).
    const reqLike = deferred()
    const reqUnlike = deferred()
    api.post
      .mockReturnValueOnce(reqLike.promise)
      .mockReturnValueOnce(reqUnlike.promise)

    const { result } = renderHook(() => useLikeBlog('a-slug'), { wrapper: makeWrapper(client) })

    // Tap 1: like. Reads cache=false → sends isLikedByUser:false.
    act(() => result.current.toggle('A'))
    await waitFor(() => expect(client.getQueryData(queryKeys.likes.status('A'))).toBe(true))

    // Tap 2, while tap 1 is STILL pending: must read the freshly-flipped cache=true and
    // send isLikedByUser:true (unlike) — not drop, not repeat the like.
    act(() => result.current.toggle('A'))
    await waitFor(() => expect(client.getQueryData(queryKeys.likes.status('A'))).toBe(false))

    expect(api.post).toHaveBeenCalledTimes(2)
    expect(api.post).toHaveBeenNthCalledWith(1, '/like-blog', { _id: 'A', isLikedByUser: false })
    expect(api.post).toHaveBeenNthCalledWith(2, '/like-blog', { _id: 'A', isLikedByUser: true })

    // Both settle in order: end state is unliked, count back to 5.
    await act(async () => reqLike.resolve({ data: { liked_by_user: true, total_likes: 6 } }))
    await act(async () => reqUnlike.resolve({ data: { liked_by_user: false, total_likes: 5 } }))
    await waitFor(() => expect(feedLikes(client, 'A')).toBe(5))
    expect(client.getQueryData(queryKeys.likes.status('A'))).toBe(false)
  })

  it('ignores a superseded tap whose response lands AFTER the latest (out-of-order guard)', async () => {
    const client = makeClient()
    seedFeed(client, [blog('A', 'a-slug', 5)])
    client.setQueryData(queryKeys.likes.status('A'), false)
    const reqLike = deferred()
    const reqUnlike = deferred()
    api.post
      .mockReturnValueOnce(reqLike.promise)
      .mockReturnValueOnce(reqUnlike.promise)

    const { result } = renderHook(() => useLikeBlog('a-slug'), { wrapper: makeWrapper(client) })

    act(() => result.current.toggle('A'))                          // tap 1: like  (seq 1)
    await waitFor(() => expect(client.getQueryData(queryKeys.likes.status('A'))).toBe(true))
    act(() => result.current.toggle('A'))                          // tap 2: unlike (seq 2, latest)
    await waitFor(() => expect(client.getQueryData(queryKeys.likes.status('A'))).toBe(false))

    // The LATEST tap (unlike) resolves FIRST — commits liked:false / 5.
    await act(async () => reqUnlike.resolve({ data: { liked_by_user: false, total_likes: 5 } }))
    await waitFor(() => expect(feedLikes(client, 'A')).toBe(5))

    // The superseded tap (like) resolves LATE with liked:true / 6 — must be IGNORED,
    // not allowed to stamp the stale liked/6 over the user's final unliked state.
    await act(async () => reqLike.resolve({ data: { liked_by_user: true, total_likes: 6 } }))

    expect(feedLikes(client, 'A')).toBe(5)
    expect(client.getQueryData(queryKeys.likes.status('A'))).toBe(false)
  })

  it('keeps the optimistic value if the server omits total_likes (older server)', async () => {
    const client = makeClient()
    seedFeed(client, [blog('A', 'a-slug', 5)])
    client.setQueryData(queryKeys.likes.status('A'), false)
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useLikeBlog('a-slug'), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ _id: 'A', isLikedByUser: false }))
    await waitFor(() => expect(feedLikes(client, 'A')).toBe(6))

    await act(async () => req.resolve({ data: { liked_by_user: true } })) // no count
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(feedLikes(client, 'A')).toBe(6) // no crash, optimistic value retained
  })
})
