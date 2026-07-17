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
import { useFollowUser } from './useFollowUser'

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

const statusKey = (userId) => queryKeys.follow.status(userId)
const status = (client, userId) => client.getQueryData(statusKey(userId))

describe('useFollowUser', () => {
  // NOTE ON SHAPE: this cache holds a BOOLEAN. useFollowStatus's queryFn is
  // `return data.following`, so `true`/`false` is the only thing a real fetch ever writes —
  // these tests seed booleans to match. (`followsBack` is NOT in here; useFollowsBack owns
  // its own query key.)

  it('optimistically sets true on a follow action and keeps it on success', async () => {
    const client = makeClient()
    client.setQueryData(statusKey('u1'), false)
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useFollowUser(), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ userId: 'u1', action: 'follow' }))

    // onMutate is async (awaits cancelQueries) — wait for the optimistic patch.
    await waitFor(() => expect(status(client, 'u1')).toBe(true))

    await act(async () => req.resolve({ data: {} }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Server confirmed — the optimistic flag remains true.
    expect(status(client, 'u1')).toBe(true)
    // The correct endpoint was hit with the user id in the body.
    expect(api.post).toHaveBeenCalledWith('/follow', { user_id: 'u1' })
  })

  it('optimistically sets false on an unfollow action', async () => {
    const client = makeClient()
    client.setQueryData(statusKey('u2'), true)
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useFollowUser(), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ userId: 'u2', action: 'unfollow' }))

    await waitFor(() => expect(status(client, 'u2')).toBe(false))

    await act(async () => req.resolve({ data: {} }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(status(client, 'u2')).toBe(false)
    expect(api.post).toHaveBeenCalledWith('/unfollow', { user_id: 'u2' })
  })

  it('writes a falsy boolean on unfollow, never a truthy object', async () => {
    // Regression: onMutate used to write `{ ...old, isFollowing: action === 'follow' }`.
    // Spreading a boolean yields {}, so the cache became `{ isFollowing: false }` — an OBJECT,
    // and every object is truthy. Consumers read `data` directly as the flag, so an unfollow
    // kept rendering as "Following" until the onSettled refetch corrected it.
    const client = makeClient()
    client.setQueryData(statusKey('u3'), true)
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useFollowUser(), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ userId: 'u3', action: 'unfollow' }))

    await waitFor(() => expect(status(client, 'u3')).toBe(false))
    expect(typeof status(client, 'u3')).toBe('boolean')
    expect(status(client, 'u3')).toBeFalsy()

    await act(async () => req.resolve({ data: {} }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('rolls back to the prior snapshot on error', async () => {
    const client = makeClient()
    const prior = false
    client.setQueryData(statusKey('u4'), prior)
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useFollowUser(), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ userId: 'u4', action: 'follow' }))

    // Optimistic patch applied first.
    await waitFor(() => expect(status(client, 'u4')).toBe(true))

    await act(async () => req.reject(new Error('network down')))
    await waitFor(() => expect(result.current.isError).toBe(true))

    // Rolled back to the exact prior snapshot.
    expect(status(client, 'u4')).toBe(prior)
  })

  it('a failed follow on one user does not affect a concurrent follow on another', async () => {
    const client = makeClient()
    client.setQueryData(statusKey('a'), false)
    client.setQueryData(statusKey('b'), false)

    const reqA = deferred()
    const reqB = deferred()
    api.post.mockImplementation((_url, body) => (body.user_id === 'a' ? reqA.promise : reqB.promise))

    const wrapper = makeWrapper(client)
    const { result: rA } = renderHook(() => useFollowUser(), { wrapper })
    const { result: rB } = renderHook(() => useFollowUser(), { wrapper })

    act(() => rA.current.mutate({ userId: 'a', action: 'follow' }))
    act(() => rB.current.mutate({ userId: 'b', action: 'follow' }))

    await waitFor(() => expect(status(client, 'a')).toBe(true))
    await waitFor(() => expect(status(client, 'b')).toBe(true))

    // A fails while B succeeds.
    await act(async () => {
      reqA.reject(new Error('fail A'))
      reqB.resolve({ data: {} })
    })
    await waitFor(() => expect(rA.current.isError).toBe(true))
    await waitFor(() => expect(rB.current.isSuccess).toBe(true))

    // A rolled back; B's optimistic follow survives.
    expect(status(client, 'a')).toBe(false)
    expect(status(client, 'b')).toBe(true)
  })
})
