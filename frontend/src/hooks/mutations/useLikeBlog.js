import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { UserContext } from '../../App';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Immutably adjust a blog's `total_likes` wherever it lives in the query cache.
 *
 * Blog data is stored in three shapes, all under the ['blogs'] key prefix:
 *   - Infinite feed:  { pages: [{ blogs: [...] }], pageParams }  (latest, category, following, search, user-written)
 *   - Flat array:     [ ...blogs ]                                (trending, similar)
 *   - Single object:  { _id, activity, ... }                     (blog detail)
 *
 * Only the blog matching `targetId` (`_id`) is touched; everything else is
 * returned by reference so React's structural sharing skips unaffected nodes.
 */
const patchBlogLikes = (data, targetId, delta) => {
  if (!data) return data;

  const bump = (blog) =>
    blog && blog._id === targetId
      ? {
          ...blog,
          activity: {
            ...blog.activity,
            total_likes: Math.max(0, (blog.activity?.total_likes || 0) + delta),
          },
        }
      : blog;

  // Infinite query
  if (Array.isArray(data.pages)) {
    return {
      ...data,
      pages: data.pages.map((page) =>
        page && Array.isArray(page.blogs)
          ? { ...page, blogs: page.blogs.map(bump) }
          : page,
      ),
    };
  }

  // Flat array of blogs
  if (Array.isArray(data)) {
    return data.map(bump);
  }

  // Single blog object (detail)
  if (data._id) {
    return bump(data);
  }

  return data;
};

/**
 * Same traversal as `patchBlogLikes`, but SETS an absolute count instead of applying a delta.
 *
 * Used to accept the server's authoritative `total_likes`. The optimistic delta is only a guess:
 * the client sends what it *thinks* the current state is, and when that guess is wrong (status
 * query still loading, stale, or a rapid second click) the server correctly no-ops — leaving the
 * optimistic +1/-1 stranded on screen until a refresh "reverted" it. Writing the real number on
 * success makes any wrong guess self-correct immediately.
 */
const setBlogLikes = (data, targetId, total) => {
  if (!data) return data;

  const set = (blog) =>
    blog && blog._id === targetId
      ? { ...blog, activity: { ...blog.activity, total_likes: total } }
      : blog;

  if (Array.isArray(data.pages)) {
    return {
      ...data,
      pages: data.pages.map((page) =>
        page && Array.isArray(page.blogs) ? { ...page, blogs: page.blogs.map(set) } : page,
      ),
    };
  }
  if (Array.isArray(data)) return data.map(set);
  if (data._id) return set(data);
  return data;
};

/**
 * Optimistic mutation for liking or unliking a blog post.
 *
 * Patches the like-status boolean AND the `total_likes` count across every blog
 * cache (all feeds + detail) so the count is durable across card remounts and
 * cross-feed — not just held in a card's local state. Snapshots every touched
 * cache for rollback on error, and marks feeds stale (no refetch) on settle.
 *
 * @param {string} blogId - The `blog_id` slug used for the blog detail query.
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useLikeBlog = (blogId) => {
  const queryClient = useQueryClient();
  const { userAuth: { access_token } } = useContext(UserContext);

  return useMutation({
    mutationFn: ({ _id, isLikedByUser }) =>
      api.post('/like-blog', { _id, isLikedByUser }),

    onMutate: async ({ _id, isLikedByUser }) => {
      const delta = isLikedByUser ? -1 : 1;

      // Cancel only the per-id like-status and the single blog-detail query —
      // both are safe to pause. We deliberately do NOT cancel the shared feed
      // (infinite) queries: cancelling them would abort in-flight pagination /
      // initial loads for the whole feed.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.likes.status(_id) }),
        queryClient.cancelQueries({ queryKey: queryKeys.blogs.detail(blogId) }),
      ]);

      // Snapshot only the per-id like-status boolean (per-blog key, so no
      // collision with concurrent likes on other blogs). The COUNT is rolled
      // back with an inverse delta below rather than a whole-cache snapshot, so
      // a failed like can't wipe a different blog's still-pending optimistic +1.
      const previousLikeStatus = queryClient.getQueryData(queryKeys.likes.status(_id));

      queryClient.setQueryData(queryKeys.likes.status(_id), !isLikedByUser);

      // Optimistically patch total_likes for THIS blog in every blog cache
      // (feeds + detail) so the count survives card remounts and stays
      // consistent across feeds without refetching.
      queryClient.setQueriesData(
        { queryKey: queryKeys.blogs.all() },
        (old) => patchBlogLikes(old, _id, delta),
      );

      return { previousLikeStatus, _id, delta };
    },

    // The server is the authority. It answers with the real `liked_by_user` + `total_likes` on
    // every path — including the idempotent no-ops it takes when our `isLikedByUser` guess was
    // wrong — so adopt those numbers rather than keeping the optimistic delta.
    onSuccess: (response, variables) => {
      const { liked_by_user, total_likes } = response?.data || {};

      if (typeof liked_by_user === 'boolean') {
        queryClient.setQueryData(queryKeys.likes.status(variables._id), liked_by_user);
      }
      if (typeof total_likes === 'number') {
        queryClient.setQueriesData(
          { queryKey: queryKeys.blogs.all() },
          (old) => setBlogLikes(old, variables._id, total_likes),
        );
      }
    },

    onError: (_error, _variables, context) => {
      if (!context) return;
      // Restore the boolean, and undo ONLY this blog's count change with the
      // inverse delta — leaving any concurrent optimistic patches on other
      // blogs (which share the same feed cache object) intact.
      queryClient.setQueryData(
        queryKeys.likes.status(context._id),
        context.previousLikeStatus,
      );
      queryClient.setQueriesData(
        { queryKey: queryKeys.blogs.all() },
        (old) => patchBlogLikes(old, context._id, -context.delta),
      );
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.likes.status(variables._id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.blogs.detail(blogId) });
      // Feeds already carry the durable, optimistic count, so no immediate
      // refetch is needed. Mark them stale so other users' like changes (and any
      // rare in-flight-refetch drift) reconcile on the next natural refetch
      // (focus / navigation) — instead of re-downloading every loaded feed page
      // on every like tap.
      queryClient.invalidateQueries({ queryKey: queryKeys.blogs.all(), refetchType: 'none' });
    },
  });
};
