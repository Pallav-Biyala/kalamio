import api from './api';
import { createBatchLoader } from './createBatchLoader';

/**
 * Batched loader for per-blog like status.
 *
 * Every useLikeStatus(id) whose query actually fetches within the same tick is
 * coalesced into ONE `POST /batch-isliked` instead of N `/isliked-by-user` calls
 * — so a 20-card feed does 1 request, not 20. Each blog keeps its own
 * `likes.status(id)` cache entry, so optimistic like mutations are unaffected.
 *
 * @param {string} blogId - blog `_id`
 * @returns {Promise<boolean>} whether the current user has liked that blog
 */
export const loadLikeStatus = createBatchLoader(async (blogIds) => {
  const { data } = await api.post('/batch-isliked', { blog_ids: blogIds });
  const liked = new Set(data.likedBlogs || []);
  return new Map(blogIds.map((id) => [id, liked.has(id)]));
});
