import { describe, it, expect, vi } from 'vitest'
import { renderHook, render, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '../../test/msw/server'
import { API } from '../../test/msw/handlers'

// UserContext only — this test uses the REAL api instance + batched loader so
// MSW intercepts the actual HTTP call end-to-end.
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

describe('useLikeStatus (batched via /batch-isliked)', () => {
  it('returns true when the blog appears in the batch response', async () => {
    server.use(
      http.post(`${API}/batch-isliked`, () => HttpResponse.json({ likedBlogs: ['blog-1'] })),
    )
    const client = makeClient()
    const { result } = renderHook(() => useLikeStatus('blog-1'), {
      wrapper: makeWrapper(client),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(true)
  })

  it('returns false when the blog is absent from the batch response', async () => {
    server.use(
      http.post(`${API}/batch-isliked`, () => HttpResponse.json({ likedBlogs: [] })),
    )
    const client = makeClient()
    const { result } = renderHook(() => useLikeStatus('blog-2'), {
      wrapper: makeWrapper(client),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(false)
  })

  it('coalesces many concurrent card checks into ONE /batch-isliked request (N→1)', async () => {
    const requestBodies = []
    server.use(
      http.post(`${API}/batch-isliked`, async ({ request }) => {
        const body = await request.json()
        requestBodies.push(body.blog_ids)
        return HttpResponse.json({
          likedBlogs: body.blog_ids.filter((id) => id === 'liked-1'),
        })
      }),
    )
    const client = makeClient()
    const Wrapper = makeWrapper(client)

    const captured = {}
    function Row({ id }) {
      captured[id] = useLikeStatus(id).data
      return null
    }

    // Three cards mounted in a single commit → their fetches share a tick.
    render(
      <Wrapper>
        <Row id="liked-1" />
        <Row id="plain-2" />
        <Row id="plain-3" />
      </Wrapper>,
    )

    await waitFor(() => expect(captured['liked-1']).toBe(true))
    expect(captured['plain-2']).toBe(false)
    expect(captured['plain-3']).toBe(false)

    // The three checks hit the network exactly once, carrying all three ids.
    expect(requestBodies).toHaveLength(1)
    expect([...requestBodies[0]].sort()).toEqual(['liked-1', 'plain-2', 'plain-3'])
  })

  it('does not fire a request when unauthenticated (query disabled)', () => {
    const client = makeClient()
    const { result } = renderHook(() => useLikeStatus('blog-1'), {
      wrapper: makeWrapper(client, null),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })
})
