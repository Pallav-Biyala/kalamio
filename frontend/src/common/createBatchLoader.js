/**
 * Coalesces many single-key async lookups made within the same tick into ONE
 * batched call — the classic DataLoader pattern.
 *
 * Used so that a feed of N cards, each independently asking "did I like this
 * blog?", results in a single POST /batch-isliked instead of N /isliked-by-user
 * requests. Each caller still gets its own resolved value.
 *
 * @param {(keys: string[]) => Promise<Map<string, any>>} batchFn
 *   Resolves a list of unique keys to a Map of key -> value. A key missing from
 *   the returned Map resolves to `undefined` for its callers.
 * @param {{ scheduleMs?: number }} [opts]
 *   How long to keep collecting keys before firing (default 0 = flush at the end
 *   of the current macrotask, which captures a full React commit's worth of queries).
 * @returns {(key: string) => Promise<any>} load(key)
 */
export function createBatchLoader(batchFn, { scheduleMs = 0 } = {}) {
  // key -> array of { resolve, reject } (an array so duplicate keys in one batch
  // share a single fetch but each caller still settles).
  let pending = new Map();
  let timer = null;

  const flush = () => {
    const batch = pending;
    pending = new Map();
    timer = null;

    const keys = [...batch.keys()];

    Promise.resolve()
      .then(() => batchFn(keys))
      .then((result) => {
        keys.forEach((key) => {
          const value = result && typeof result.get === 'function' ? result.get(key) : undefined;
          batch.get(key).forEach(({ resolve }) => resolve(value));
        });
      })
      .catch((error) => {
        keys.forEach((key) => {
          batch.get(key).forEach(({ reject }) => reject(error));
        });
      });
  };

  return function load(key) {
    return new Promise((resolve, reject) => {
      if (!pending.has(key)) pending.set(key, []);
      pending.get(key).push({ resolve, reject });
      if (timer === null) timer = setTimeout(flush, scheduleMs);
    });
  };
}
