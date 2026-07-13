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
import { useVotePoll } from './useVotePoll'

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

const voteStatus = (client, blogId) =>
  client.getQueryData(queryKeys.polls.voteStatus(blogId))

describe('useVotePoll', () => {
  it('optimistically marks the poll as voted with the chosen option and keeps it on success', async () => {
    const client = makeClient()
    // Seed the pre-vote status the hook reads & patches.
    client.setQueryData(queryKeys.polls.voteStatus('blog-1'), {
      hasVoted: false,
      option_index: null,
      total_votes: 10,
    })
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useVotePoll(), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ blogId: 'blog-1', optionIndex: 2 }))

    // onMutate is async (awaits cancelQueries) — wait for the optimistic patch.
    await waitFor(() => expect(voteStatus(client, 'blog-1').hasVoted).toBe(true))
    expect(voteStatus(client, 'blog-1').option_index).toBe(2)
    // Untouched fields are preserved via spread.
    expect(voteStatus(client, 'blog-1').total_votes).toBe(10)

    // The correct payload was sent to the api layer.
    expect(api.post).toHaveBeenCalledWith('/vote-poll', {
      blog_id: 'blog-1',
      option_index: 2,
    })

    await act(async () => req.resolve({ data: { success: true } }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // Optimistic values remain after a successful settle (before refetch data arrives).
    expect(voteStatus(client, 'blog-1').hasVoted).toBe(true)
    expect(voteStatus(client, 'blog-1').option_index).toBe(2)
  })

  it('rolls back to the previous vote status on error', async () => {
    const client = makeClient()
    const previous = { hasVoted: false, option_index: null, total_votes: 3 }
    client.setQueryData(queryKeys.polls.voteStatus('blog-9'), previous)
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useVotePoll(), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ blogId: 'blog-9', optionIndex: 1 }))

    // Optimistic patch lands first.
    await waitFor(() => expect(voteStatus(client, 'blog-9').hasVoted).toBe(true))
    expect(voteStatus(client, 'blog-9').option_index).toBe(1)

    await act(async () => req.reject(new Error('network down')))
    await waitFor(() => expect(result.current.isError).toBe(true))

    // Cache is restored to the exact previous snapshot.
    expect(voteStatus(client, 'blog-9')).toEqual(previous)
    expect(voteStatus(client, 'blog-9').hasVoted).toBe(false)
    expect(voteStatus(client, 'blog-9').option_index).toBe(null)
  })

  it('removes the optimistically-created entry on error when there was no prior cache (regression)', async () => {
    const client = makeClient()
    // No seed: previousVoteStatus captured by onMutate is undefined.
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useVotePoll(), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ blogId: 'blog-empty', optionIndex: 0 }))

    // Optimistic write creates the entry from `old === undefined`.
    await waitFor(() => expect(voteStatus(client, 'blog-empty')).toBeTruthy())
    expect(voteStatus(client, 'blog-empty')).toEqual({ hasVoted: true, option_index: 0 })

    await act(async () => req.reject(new Error('boom')))
    await waitFor(() => expect(result.current.isError).toBe(true))

    // FIX: when there was no prior data, setQueryData(key, undefined) would be a
    // no-op and leave the stale optimistic entry. onError now removeQueries()
    // that key instead, so the cache is truly clean after a failed first vote.
    expect(voteStatus(client, 'blog-empty')).toBeUndefined()
  })

  it('invalidates both the poll vote status and the blog detail on settle', async () => {
    const client = makeClient()
    client.setQueryData(queryKeys.polls.voteStatus('blog-5'), {
      hasVoted: false,
      option_index: null,
    })
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const req = deferred()
    api.post.mockReturnValue(req.promise)

    const { result } = renderHook(() => useVotePoll(), { wrapper: makeWrapper(client) })
    act(() => result.current.mutate({ blogId: 'blog-5', optionIndex: 0 }))

    await act(async () => req.resolve({ data: {} }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0].queryKey)
    expect(invalidatedKeys).toContainEqual(queryKeys.polls.voteStatus('blog-5'))
    expect(invalidatedKeys).toContainEqual(queryKeys.blogs.detail('blog-5'))
  })

  it('a failed vote on one poll does not disturb a concurrent vote on another', async () => {
    const client = makeClient()
    client.setQueryData(queryKeys.polls.voteStatus('poll-A'), { hasVoted: false, option_index: null })
    client.setQueryData(queryKeys.polls.voteStatus('poll-B'), { hasVoted: false, option_index: null })

    const reqA = deferred()
    const reqB = deferred()
    api.post.mockImplementation((_url, body) =>
      body.blog_id === 'poll-A' ? reqA.promise : reqB.promise,
    )

    const wrapper = makeWrapper(client)
    const { result: rA } = renderHook(() => useVotePoll(), { wrapper })
    const { result: rB } = renderHook(() => useVotePoll(), { wrapper })

    act(() => rA.current.mutate({ blogId: 'poll-A', optionIndex: 1 }))
    act(() => rB.current.mutate({ blogId: 'poll-B', optionIndex: 3 }))

    await waitFor(() => expect(voteStatus(client, 'poll-A').hasVoted).toBe(true))
    await waitFor(() => expect(voteStatus(client, 'poll-B').hasVoted).toBe(true))

    await act(async () => {
      reqA.reject(new Error('fail A'))
      reqB.resolve({ data: {} })
    })
    await waitFor(() => expect(rA.current.isError).toBe(true))
    await waitFor(() => expect(rB.current.isSuccess).toBe(true))

    // A rolled back; B's optimistic vote survives.
    expect(voteStatus(client, 'poll-A').hasVoted).toBe(false)
    expect(voteStatus(client, 'poll-B').hasVoted).toBe(true)
    expect(voteStatus(client, 'poll-B').option_index).toBe(3)
  })
})
