/**
 * Propagate a profile change (photo / username) to every cached React Query surface that
 * embeds the current user's data, so avatars and names update everywhere without a refresh.
 *
 * The server stores users as refs and populates them fresh on every query, so a refetch always
 * returns the new profile_img/username. This helper does two things:
 *   1. Optimistic patch — deep-walk every cached query and merge `patch` into any embedded user
 *      object whose _id matches the current user, so the swap is INSTANT (no refetch flash, and
 *      a removed photo disappears immediately instead of lingering during the network round-trip).
 *   2. Invalidate the author-bearing query trees so the caches reconcile with the server.
 *
 * The current user's own nav/composer avatars come from UserContext (userAuth), not from here —
 * callers update that separately via setUserAuth + session.
 *
 * Not covered (non-React-Query surfaces; they refresh on remount): the inline blog-comment list
 * and the messages/chat views, which use raw fetches into local component state.
 */

// Query-key roots whose cached data embeds user/author objects (matched by prefix).
// (Reels live under ['blogs','latest','reels'] so ['blogs'] already covers reads.)
const AUTHOR_BEARING_KEYS = [
    ["blogs"],         // feeds, detail, similar, search, user-written, reels
    ["users"],         // profile, search, suggestions
    ["notifications"], // actor avatars
    ["comments"],      // comment-thread
    ["connections"],
    ["collections"],
    ["publications"],
    ["subscribe"],     // subscription feed + my-subscriptions (queryKeys.subscribe.*)
];

/**
 * Deep-merge `patch` into every { _id: userId, personal_info } object reachable from `node`.
 * Returns new references only along changed paths (unchanged subtrees keep their identity, so
 * React re-renders only what actually changed). Handles arrays and infinite-query { pages } shapes.
 */
const patchUser = (node, userId, patch) => {
    if (Array.isArray(node)) {
        let changed = false;
        const next = node.map((item) => {
            const r = patchUser(item, userId, patch);
            if (r !== item) changed = true;
            return r;
        });
        return changed ? next : node;
    }

    if (node && typeof node === "object") {
        // A populated user object always carries personal_info; match by stable _id (survives a
        // username change). Blogs/comments have _id but no personal_info, so they never false-match.
        if (node.personal_info && String(node._id) === userId) {
            return { ...node, personal_info: { ...node.personal_info, ...patch } };
        }

        let changed = false;
        const next = {};
        for (const k in node) {
            if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
            const r = patchUser(node[k], userId, patch);
            if (r !== node[k]) changed = true;
            next[k] = r;
        }
        return changed ? next : node;
    }

    return node;
};

/**
 * @param queryClient  TanStack Query client
 * @param userId       current user's _id
 * @param patch        fields to merge into personal_info, e.g. { profile_img } or { username }
 */
export const propagateProfileUpdate = (queryClient, userId, patch) => {
    if (!queryClient) return;

    // 1. Instant optimistic patch across every cached query (skip if we can't identify the user).
    //    Return undefined for queries we don't change so setQueryData bails — otherwise it would
    //    dispatch a 'success' for EVERY cached query, resetting their staleness/invalidation and
    //    suppressing unrelated refetch-on-mount for the whole staleTime window.
    if (userId && patch) {
        const id = String(userId);
        queryClient.setQueriesData({ predicate: () => true }, (data) => {
            if (!data || typeof data !== "object") return undefined; // primitives hold no user ref
            const next = patchUser(data, id, patch);
            return next === data ? undefined : next;                 // unchanged → leave untouched
        });
    }

    // 2. Reconcile with the server (populated refs → refetch returns the new data). A bio/social-only
    //    edit (no patch) only affects the profile page and the blog author card, so scope it there.
    const keys = patch ? AUTHOR_BEARING_KEYS : [["users"], ["blogs"]];
    keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
};
