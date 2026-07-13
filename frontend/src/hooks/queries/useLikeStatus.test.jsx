import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '../../test/msw/server'
import { API } from '../../test/msw/handlers'

// UserContext only — this test uses the REAL api instance so MSW intercepts the
// actual HTTP call, exercising the axios interceptors end-to-end.
vi.mock('../../App', async () => {
  const { createContext } = await import('react')
  return { UserContext: createContext({}) }
})

import { UserContext } from '../../App'
import useLikeStatus from './useLikeStatus'

const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } })

const makeWrapper = (client, token = 'test') =>
  function Wrapper({ children }) {
    return (
      <QueryClientProvider client={client}>
        <UserContext.Provider value={{ userAuth: { access_token: token } }}>
          {children}
        </UserContext.Provider>
      </QueryClientProvider>
    )
  }

describe('useLikeStatus (MSW integration)', () => {
  it('fetches like status through the real api layer', async () => {
    server.use(
      http.post(`${API}/isliked-by-user`, () => HttpResponse.json({ result: true })),
    )
    const client = makeClient()
    const { result } = renderHook(() => useLikeStatus('blog-1'), {
      wrapper: makeWrapper(client),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(true)
  })

  it('coerces a falsy server result to a boolean false', async () => {
    server.use(
      http.post(`${API}/isliked-by-user`, () => HttpResponse.json({ result: 0 })),
    )
    const client = makeClient()
    const { result } = renderHook(() => useLikeStatus('blog-2'), {
      wrapper: makeWrapper(client),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(false)
  })

  it('does not fire a request when unauthenticated (query disabled)', () => {
    const client = makeClient()
    const { result } = renderHook(() => useLikeStatus('blog-1'), {
      wrapper: makeWrapper(client, null),
    })

    // enabled:false → the query stays idle and never hits MSW.
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })
})
