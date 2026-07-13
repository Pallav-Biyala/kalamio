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
  it('optimistically sets isFollowing:true on a follow action and keeps it on success', async () => {
    const client = makeClient()
    client.setQueryData(statusKey('u1'), { isFollowing: false })
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useFollowUser(), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ userId: 'u1', action: 'follow' }))

    // onMutate is async (awaits cancelQueries) — wait for the optimistic patch.
    await waitFor(() => expect(status(client, 'u1')).toEqual({ isFollowing: true }))

    await act(async () => req.resolve({ data: {} }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Server confirmed — the optimistic flag remains true.
    expect(status(client, 'u1').isFollowing).toBe(true)
    // The correct endpoint was hit with the user id in the body.
    expect(api.post).toHaveBeenCalledWith('/follow', { user_id: 'u1' })
  })

  it('optimistically sets isFollowing:false on an unfollow action', async () => {
    const client = makeClient()
    client.setQueryData(statusKey('u2'), { isFollowing: true })
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useFollowUser(), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ userId: 'u2', action: 'unfollow' }))

    await waitFor(() => expect(status(client, 'u2')).toEqual({ isFollowing: false }))

    await act(async () => req.resolve({ data: {} }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(status(client, 'u2').isFollowing).toBe(false)
    expect(api.post).toHaveBeenCalledWith('/unfollow', { user_id: 'u2' })
  })

  it('preserves other fields in the cached status while patching isFollowing', async () => {
    const client = makeClient()
    client.setQueryData(statusKey('u3'), { isFollowing: false, followsBack: true })
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useFollowUser(), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ userId: 'u3', action: 'follow' }))

    await waitFor(() =>
      expect(status(client, 'u3')).toEqual({ isFollowing: true, followsBack: true }),
    )

    await act(async () => req.resolve({ data: {} }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('rolls back to the prior snapshot on error', async () => {
    const client = makeClient()
    const prior = { isFollowing: false, followsBack: false }
    client.setQueryData(statusKey('u4'), prior)
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useFollowUser(), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ userId: 'u4', action: 'follow' }))

    // Optimistic patch applied first.
    await waitFor(() => expect(status(client, 'u4').isFollowing).toBe(true))

    await act(async () => req.reject(new Error('network down')))
    await waitFor(() => expect(result.current.isError).toBe(true))

    // Rolled back to the exact prior snapshot.
    expect(status(client, 'u4')).toEqual(prior)
  })

  it('a failed follow on one user does not affect a concurrent follow on another', async () => {
    const client = makeClient()
    client.setQueryData(statusKey('a'), { isFollowing: false })
    client.setQueryData(statusKey('b'), { isFollowing: false })

    const reqA = deferred()
    const reqB = deferred()
    api.post.mockImplementation((_url, body) => (body.user_id === 'a' ? reqA.promise : reqB.promise))

    const wrapper = makeWrapper(client)
    const { result: rA } = renderHook(() => useFollowUser(), { wrapper })
    const { result: rB } = renderHook(() => useFollowUser(), { wrapper })

    act(() => rA.current.mutate({ userId: 'a', action: 'follow' }))
    act(() => rB.current.mutate({ userId: 'b', action: 'follow' }))

    await waitFor(() => expect(status(client, 'a').isFollowing).toBe(true))
    await waitFor(() => expect(status(client, 'b').isFollowing).toBe(true))

    // A fails while B succeeds.
    await act(async () => {
      reqA.reject(new Error('fail A'))
      reqB.resolve({ data: {} })
    })
    await waitFor(() => expect(rA.current.isError).toBe(true))
    await waitFor(() => expect(rB.current.isSuccess).toBe(true))

    // A rolled back; B's optimistic follow survives.
    expect(status(client, 'a').isFollowing).toBe(false)
    expect(status(client, 'b').isFollowing).toBe(true)
  })
})
