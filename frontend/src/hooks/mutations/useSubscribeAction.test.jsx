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
import { useSubscribeAction } from './useSubscribeAction'

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

const statusKey = (pubId) => queryKeys.subscribe.status(pubId)
const status = (client, pubId) => client.getQueryData(statusKey(pubId))

describe('useSubscribeAction', () => {
  it('optimistically flips isSubscribed to true on subscribe and keeps it on success', async () => {
    const client = makeClient()
    // Seed existing status cache with extra fields the patch must preserve.
    client.setQueryData(statusKey('pub-1'), { isSubscribed: false, subscriberCount: 10 })
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useSubscribeAction(), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ publicationId: 'pub-1', action: 'subscribe' }))

    // onMutate is async (awaits cancelQueries) — wait for the optimistic patch.
    await waitFor(() => expect(status(client, 'pub-1').isSubscribed).toBe(true))
    // Spread preserves the rest of the object.
    expect(status(client, 'pub-1').subscriberCount).toBe(10)
    // It hit the right endpoint with the right body.
    expect(api.post).toHaveBeenCalledWith('/subscribe', { publication_id: 'pub-1' })

    await act(async () => req.resolve({ data: { ok: true } }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Server confirmed — optimistic value stays (invalidate re-fetch is a no-op
    // here since there is no queryFn registered).
    expect(status(client, 'pub-1').isSubscribed).toBe(true)
  })

  it('optimistically flips isSubscribed to false on unsubscribe', async () => {
    const client = makeClient()
    client.setQueryData(statusKey('pub-2'), { isSubscribed: true, subscriberCount: 5 })
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useSubscribeAction(), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ publicationId: 'pub-2', action: 'unsubscribe' }))

    await waitFor(() => expect(status(client, 'pub-2').isSubscribed).toBe(false))
    expect(status(client, 'pub-2').subscriberCount).toBe(5)
    expect(api.post).toHaveBeenCalledWith('/unsubscribe', { publication_id: 'pub-2' })

    await act(async () => req.resolve({ data: {} }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(status(client, 'pub-2').isSubscribed).toBe(false)
  })

  it('rolls back to the previous status object on error', async () => {
    const client = makeClient()
    const previous = { isSubscribed: false, subscriberCount: 42 }
    client.setQueryData(statusKey('pub-3'), previous)
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useSubscribeAction(), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ publicationId: 'pub-3', action: 'subscribe' }))

    // Optimistic flip lands first.
    await waitFor(() => expect(status(client, 'pub-3').isSubscribed).toBe(true))

    await act(async () => req.reject(new Error('network down')))
    await waitFor(() => expect(result.current.isError).toBe(true))

    // Rolled back to the exact previous object.
    expect(status(client, 'pub-3')).toEqual(previous)
    expect(status(client, 'pub-3').isSubscribed).toBe(false)
  })

  it('a failed subscribe on one publication does not affect another publication', async () => {
    const client = makeClient()
    client.setQueryData(statusKey('A'), { isSubscribed: false })
    client.setQueryData(statusKey('B'), { isSubscribed: false })

    const reqA = deferred()
    const reqB = deferred()
    api.post.mockImplementation((_url, body) =>
      body.publication_id === 'A' ? reqA.promise : reqB.promise,
    )

    const wrapper = makeWrapper(client)
    const { result: rA } = renderHook(() => useSubscribeAction(), { wrapper })
    const { result: rB } = renderHook(() => useSubscribeAction(), { wrapper })

    act(() => rA.current.mutate({ publicationId: 'A', action: 'subscribe' }))
    act(() => rB.current.mutate({ publicationId: 'B', action: 'subscribe' }))

    await waitFor(() => expect(status(client, 'A').isSubscribed).toBe(true))
    await waitFor(() => expect(status(client, 'B').isSubscribed).toBe(true))

    // A fails while B succeeds.
    await act(async () => {
      reqA.reject(new Error('fail A'))
      reqB.resolve({ data: {} })
    })
    await waitFor(() => expect(rA.current.isError).toBe(true))
    await waitFor(() => expect(rB.current.isSuccess).toBe(true))

    // A rolled back to false; B's optimistic true survives.
    expect(status(client, 'A').isSubscribed).toBe(false)
    expect(status(client, 'B').isSubscribed).toBe(true)
  })

  it('invalidates subscribe.status and reaches the publication detail (keyed by slug) on settle (regression)', async () => {
    const client = makeClient()
    client.setQueryData(statusKey('pub-9'), { isSubscribed: false })
    // A real publication-detail query is keyed by SLUG — but the hook only has
    // the id. Seed one so we can prove the invalidation actually reaches it.
    client.setQueryData(queryKeys.publications.detail('my-pub-slug'), { subscriberCount: 100 })
    const spy = vi.spyOn(client, 'invalidateQueries')
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useSubscribeAction(), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ publicationId: 'pub-9', action: 'subscribe' }))

    await act(async () => req.resolve({ data: {} }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const invalidatedKeys = spy.mock.calls.map((c) => c[0].queryKey)
    expect(invalidatedKeys).toContainEqual(queryKeys.subscribe.status('pub-9'))

    // FIX: invalidating the ['publications'] prefix reaches the slug-keyed detail
    // query — the old detail(id) key never matched it. Proven by isInvalidated.
    expect(invalidatedKeys).toContainEqual(queryKeys.publications.all())
    expect(
      client.getQueryState(queryKeys.publications.detail('my-pub-slug')).isInvalidated,
    ).toBe(true)
  })
})
