import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  useSeo,
  buildArticleJsonLd,
  SITE_NAME,
  DEFAULT_DESCRIPTION,
  DEFAULT_IMAGE,
  PRODUCTION_ORIGIN,
} from './useSeo'

const wrapper = (path = '/') =>
  function Wrapper({ children }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  }

const meta = (attr, key) =>
  document.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content')
const canonical = () =>
  document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')
const jsonLd = () => {
  const el = document.getElementById('seo-jsonld')
  return el ? JSON.parse(el.textContent) : null
}

describe('useSeo', () => {
  it('sets title, description, canonical, OG and Twitter tags from full input', () => {
    renderHook(
      () =>
        useSeo({
          title: 'My Post',
          description: 'A great read',
          image: 'https://cdn.example/x.png',
          url: 'https://kalamio.com/blog/abc',
          type: 'article',
        }),
      { wrapper: wrapper('/blog/abc') },
    )

    expect(document.title).toBe('My Post — Kalamio')
    expect(meta('name', 'description')).toBe('A great read')
    expect(meta('property', 'og:site_name')).toBe(SITE_NAME)
    expect(meta('property', 'og:type')).toBe('article')
    expect(meta('property', 'og:title')).toBe('My Post')
    expect(meta('property', 'og:description')).toBe('A great read')
    expect(meta('property', 'og:url')).toBe('https://kalamio.com/blog/abc')
    expect(meta('property', 'og:image')).toBe('https://cdn.example/x.png')
    expect(meta('name', 'twitter:card')).toBe('summary_large_image')
    expect(meta('name', 'twitter:title')).toBe('My Post')
    expect(meta('name', 'twitter:image')).toBe('https://cdn.example/x.png')
    expect(canonical()).toBe('https://kalamio.com/blog/abc')
  })

  it('falls back to site defaults and derives the canonical from the path', () => {
    renderHook(() => useSeo({ title: 'Bare' }), { wrapper: wrapper('/some/page') })

    expect(meta('name', 'description')).toBe(DEFAULT_DESCRIPTION)
    expect(meta('property', 'og:description')).toBe(DEFAULT_DESCRIPTION)
    expect(meta('property', 'og:image')).toBe(DEFAULT_IMAGE)
    expect(canonical()).toBe(`${PRODUCTION_ORIGIN}/some/page`)
  })

  it('renders just the site name when no title is given', () => {
    renderHook(() => useSeo({}), { wrapper: wrapper('/') })
    expect(document.title).toBe(SITE_NAME)
    expect(meta('property', 'og:title')).toBe(SITE_NAME)
  })

  it('emits index,follow by default and noindex,nofollow when requested', () => {
    const { unmount } = renderHook(() => useSeo({ title: 'Public' }), {
      wrapper: wrapper('/blog/x'),
    })
    expect(meta('name', 'robots')).toBe('index, follow')
    unmount()

    renderHook(() => useSeo({ title: 'Private', noindex: true }), {
      wrapper: wrapper('/settings/profile'),
    })
    expect(meta('name', 'robots')).toBe('noindex, nofollow')
  })

  it('injects JSON-LD structured data and removes it on unmount', () => {
    const article = buildArticleJsonLd({
      title: 'Hello',
      description: 'Desc',
      image: 'https://cdn.example/banner.png',
      url: 'https://kalamio.com/blog/hello',
      publishedAt: '2026-01-01T00:00:00.000Z',
      authorName: 'Ada',
      authorUsername: 'ada',
    })

    const { unmount } = renderHook(() => useSeo({ title: 'Hello', jsonLd: article }), {
      wrapper: wrapper('/blog/hello'),
    })

    const ld = jsonLd()
    expect(ld['@type']).toBe('BlogPosting')
    expect(ld.headline).toBe('Hello')
    expect(ld.author.name).toBe('Ada')
    expect(ld.author.url).toBe(`${PRODUCTION_ORIGIN}/user/ada`)
    expect(ld.publisher.name).toBe(SITE_NAME)

    unmount()
    expect(jsonLd()).toBeNull() // page-specific data must not leak to the next route
  })
})
