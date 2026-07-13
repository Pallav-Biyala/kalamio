import { describe, it, expect, vi } from 'vitest'
import { createBatchLoader } from './createBatchLoader'

describe('createBatchLoader', () => {
  it('coalesces same-tick loads into a single batchFn call', async () => {
    const batchFn = vi.fn(async (keys) => new Map(keys.map((k) => [k, k.toUpperCase()])))
    const load = createBatchLoader(batchFn)

    const [a, b, c] = await Promise.all([load('a'), load('b'), load('c')])

    expect(batchFn).toHaveBeenCalledTimes(1)
    expect(batchFn).toHaveBeenCalledWith(['a', 'b', 'c'])
    expect([a, b, c]).toEqual(['A', 'B', 'C'])
  })

  it('dedupes repeated keys in one batch but still settles every caller', async () => {
    const batchFn = vi.fn(async (keys) => new Map(keys.map((k) => [k, k])))
    const load = createBatchLoader(batchFn)

    const [a1, a2, b] = await Promise.all([load('a'), load('a'), load('b')])

    expect(batchFn).toHaveBeenCalledTimes(1)
    expect(batchFn.mock.calls[0][0]).toEqual(['a', 'b']) // 'a' collapsed to one key
    expect([a1, a2, b]).toEqual(['a', 'a', 'b'])
  })

  it('starts a fresh batch on the next tick', async () => {
    const batchFn = vi.fn(async (keys) => new Map(keys.map((k) => [k, k])))
    const load = createBatchLoader(batchFn)

    await load('a')
    await load('b')

    expect(batchFn).toHaveBeenCalledTimes(2)
  })

  it('rejects every caller when the batch fails', async () => {
    const batchFn = vi.fn(async () => {
      throw new Error('boom')
    })
    const load = createBatchLoader(batchFn)

    await expect(Promise.all([load('a'), load('b')])).rejects.toThrow('boom')
  })

  it('resolves undefined for keys the batch response omits', async () => {
    const batchFn = vi.fn(async () => new Map())
    const load = createBatchLoader(batchFn)

    await expect(load('missing')).resolves.toBeUndefined()
  })
})
