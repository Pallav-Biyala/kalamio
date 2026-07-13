import { describe, it, expect } from 'vitest'
import { queryKeys } from './queryKeys'

describe('queryKeys.follow.batchStatus', () => {
  it('is order-independent — [b,a] deep-equals [a,b]', () => {
    expect(queryKeys.follow.batchStatus(['b', 'a'])).toEqual(
      queryKeys.follow.batchStatus(['a', 'b']),
    )
  })

  it('produces exactly 3 elements ["follow","batch","a,b"]', () => {
    const key = queryKeys.follow.batchStatus(['b', 'a'])
    expect(key).toEqual(['follow', 'batch', 'a,b'])
    expect(key).toHaveLength(3)
  })

  it('stays fixed-length regardless of how many ids are passed', () => {
    expect(queryKeys.follow.batchStatus(['a'])).toHaveLength(3)
    expect(queryKeys.follow.batchStatus(['a', 'b', 'c', 'd'])).toHaveLength(3)
    // longer id list still collapses to a single comma-joined segment
    expect(queryKeys.follow.batchStatus(['c', 'a', 'b'])).toEqual([
      'follow',
      'batch',
      'a,b,c',
    ])
  })

  it('does not mutate the caller-supplied array while sorting', () => {
    const input = ['b', 'a', 'c']
    queryKeys.follow.batchStatus(input)
    expect(input).toEqual(['b', 'a', 'c'])
  })

  it('guards null input — treats it as an empty batch', () => {
    expect(queryKeys.follow.batchStatus(null)).toEqual(['follow', 'batch', ''])
  })

  it('guards undefined input — treats it as an empty batch', () => {
    expect(queryKeys.follow.batchStatus(undefined)).toEqual([
      'follow',
      'batch',
      '',
    ])
  })

  it('guards an empty array input', () => {
    expect(queryKeys.follow.batchStatus([])).toEqual(['follow', 'batch', ''])
  })
})

describe('queryKeys hierarchical arrays', () => {
  it('likes.status produces ["likes","status",blogId]', () => {
    expect(queryKeys.likes.status('blog-1')).toEqual([
      'likes',
      'status',
      'blog-1',
    ])
  })

  it('blogs.detail produces ["blogs","detail",blogId]', () => {
    expect(queryKeys.blogs.detail('abc')).toEqual(['blogs', 'detail', 'abc'])
  })

  it('blogs.category produces ["blogs","category",tag]', () => {
    expect(queryKeys.blogs.category('tech')).toEqual([
      'blogs',
      'category',
      'tech',
    ])
  })

  it('notifications.list produces ["notifications","list",filter]', () => {
    expect(queryKeys.notifications.list('unread')).toEqual([
      'notifications',
      'list',
      'unread',
    ])
  })
})

describe('follow prefix enables broad invalidation', () => {
  const prefix = ['follow']
  const isPrefixOf = (head, key) =>
    head.every((seg, i) => key[i] === seg)

  it('["follow"] is the head of follow.status', () => {
    expect(isPrefixOf(prefix, queryKeys.follow.status('u1'))).toBe(true)
    expect(queryKeys.follow.status('u1')).toEqual(['follow', 'status', 'u1'])
  })

  it('["follow"] is the head of follow.batchStatus', () => {
    expect(isPrefixOf(prefix, queryKeys.follow.batchStatus(['u1', 'u2']))).toBe(
      true,
    )
  })

  it('["follow"] is the head of follow.followsBack', () => {
    expect(isPrefixOf(prefix, queryKeys.follow.followsBack('u1'))).toBe(true)
    expect(queryKeys.follow.followsBack('u1')).toEqual([
      'follow',
      'follows-back',
      'u1',
    ])
  })

  it('a non-follow key is NOT matched by the ["follow"] prefix', () => {
    expect(isPrefixOf(prefix, queryKeys.likes.status('blog-1'))).toBe(false)
  })
})
