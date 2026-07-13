import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '../../test/msw/server'
import { API } from '../../test/msw/handlers'

// UserContext only — this test uses the REAL api instance so MSW intercepts the
// actual /is-following HTTP call end-to-end (through the axios interceptors).
vi.mock('../../App', async () => {
  const { createContext } = await import('react')
  return { UserContext: createContext({}) }
})

import { UserContext } from '../../App'
import { queryKeys } from '../../common/queryKeys'
import useFollowStatus from './useFollowStatus'

const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } })

// The hook destructures { access_token, _id: currentUserId } from userAuth.
const makeWrapper = (client, userAuth = { access_token: 'test' }) =>
  function Wrapper({ children }) {
    return (
      <QueryClientProvider client={client}>
        <UserContext.Provider value={{ userAuth, setUserAuth: () => {} }}>
          {children}
        </UserContext.Provider>
      </QueryClientProvider>
    )
  }

describe('useFollowStatus (MSW integration)', () => {
  it('fetches /is-following and returns data.following for a different target user', async () => {
    let capturedBody
    server.use(
      http.post(`${API}/is-following`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ following: true })
      }),
    )
    const client = makeClient()
    const { result } = renderHook(
      () => useFollowStatus('target-user'),
      { wrapper: makeWrapper(client, { access_token: 'test', _id: 'me' }) },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(true)
    // Sent the correct payload through the real api layer.
    expect(capturedBody).toEqual({ user_id: 'target-user' })
  })

  it('returns following:false when the server says so', async () => {
    server.use(
      http.post(`${API}/is-following`, () => HttpResponse.json({ following: false })),
    )
    const client = makeClient()
    const { result } = renderHook(
      () => useFollowStatus('target-user'),
      { wrapper: makeWrapper(client, { access_token: 'test', _id: 'me' }) },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(false)
  })

  it('is disabled (idle, no request) when unauthenticated', async () => {
    // If the query were enabled it would hit MSW; with onUnhandledRequest:'error'
    // an accidental request would fail the test. No handler registered here.
    const client = makeClient()
    const { result } = renderHook(
      () => useFollowStatus('target-user'),
      { wrapper: makeWrapper(client, { access_token: null, _id: 'me' }) },
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()

    // Give any (erroneously) scheduled fetch a chance to fire — it must not.
    await Promise.resolve()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('is disabled when the target is the current user (self)', async () => {
    const client = makeClient()
    const { result } = renderHook(
      () => useFollowStatus('me'),
      { wrapper: makeWrapper(client, { access_token: 'test', _id: 'me' }) },
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()

    await Promise.resolve()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('is disabled when no targetUserId is provided', async () => {
    const client = makeClient()
    const { result } = renderHook(
      () => useFollowStatus(undefined),
      { wrapper: makeWrapper(client, { access_token: 'test', _id: 'me' }) },
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('seeds the value from initialData without firing a fetch', async () => {
    // No handler registered: if it fetched, MSW would error and fail the test.
    const client = makeClient()
    const { result } = renderHook(
      () => useFollowStatus('target-user', true),
      { wrapper: makeWrapper(client, { access_token: 'test', _id: 'me' }) },
    )

    // initialData is available immediately and the query is not fetching
    // (fresh within staleTime).
    expect(result.current.data).toBe(true)
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.isSuccess).toBe(true)
    expect(client.getQueryData(queryKeys.follow.status('target-user'))).toBe(true)

    await Promise.resolve()
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBe(true)
  })
})
