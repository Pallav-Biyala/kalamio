// Local, per-browser durable store for in-progress editor work — the "never lose work" safety net.
//
// This is layer 1 of autosave: it persists the whole draft (title, banner, body, description, tags)
// to IndexedDB so a refresh, tab close, crash, or device shutdown can't wipe unsaved work. It is
// intentionally client-only and independent of the server — you can't rely on a network round-trip
// finishing during a sudden shutdown, but a local write is instant and survives.
//
// IndexedDB (not localStorage) because articles can now be ~1MB+: localStorage is 5MB, synchronous
// (janks the editor on every write), and string-only. IndexedDB is async and handles large objects.
//
// Keys are scoped per user (`new:<username>` for an unsaved new post, `blog:<blog_id>` for an existing
// draft) so drafts never leak between accounts sharing a browser. Every call fails soft: if IndexedDB
// is unavailable (private mode, disabled, quota), the app keeps working — it just loses the safety net.

import { openDB } from 'idb';

const DB_NAME = 'kalamio-editor';
const STORE = 'drafts';

let _dbPromise = null;
const getDB = () => {
    if (!_dbPromise) {
        _dbPromise = openDB(DB_NAME, 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'key' });
                }
            },
        }).catch(() => null); // IndexedDB blocked/unavailable → null; every caller no-ops safely.
    }
    return _dbPromise;
};

/** Persist a draft snapshot: { key, blog_id, title, banner, content, des, tags, updatedAt }. */
export const saveLocalDraft = async (snapshot) => {
    try {
        const db = await getDB();
        if (db) await db.put(STORE, snapshot);
    } catch { /* quota / unavailable — non-fatal, the safety net is best-effort */ }
};

/** Read a draft snapshot by key, or null. */
export const getLocalDraft = async (key) => {
    try {
        const db = await getDB();
        return db ? (await db.get(STORE, key)) || null : null;
    } catch {
        return null;
    }
};

/** Remove a draft snapshot (called once its work is safely committed to the server, or discarded). */
export const deleteLocalDraft = async (key) => {
    try {
        const db = await getDB();
        if (db) await db.delete(STORE, key);
    } catch { /* ignore */ }
};

/** Drop snapshots older than maxAgeMs so IndexedDB can't grow unbounded. */
export const gcLocalDrafts = async (maxAgeMs = 30 * 24 * 60 * 60 * 1000) => {
    try {
        const db = await getDB();
        if (!db) return;
        const cutoff = Date.now() - maxAgeMs;
        const all = await db.getAll(STORE);
        const stale = all.filter((d) => !d.updatedAt || d.updatedAt < cutoff);
        if (!stale.length) return;
        const tx = db.transaction(STORE, 'readwrite');
        await Promise.all(stale.map((d) => tx.store.delete(d.key)));
        await tx.done;
    } catch { /* ignore */ }
};
