import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { UserContext } from '../../App';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Optimistic mutation for liking or unliking a blog post.
 *
 * Cancels and snapshots both the like-status and blog-detail caches so the
 * UI updates instantly. Rolls back both on error and re-fetches on settle.
 *
 * @param {string} blogId - The `blog_id` string used for the blog detail query.
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useLikeBlog = (blogId) => {
  const queryClient = useQueryClient();
  const { userAuth: { access_token } } = useContext(UserContext);

  return useMutation({
    mutationFn: ({ _id, isLikedByUser }) =>
      api.post('/like-blog', { _id, isLikedByUser }),

    onMutate: async ({ _id, isLikedByUser }) => {
      // Cancel any in-flight queries we're about to overwrite
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.likes.status(_id) }),
        queryClient.cancelQueries({ queryKey: queryKeys.blogs.detail(blogId) }),
      ]);

      // Snapshot current cache values for rollback
      const previousLikeStatus = queryClient.getQueryData(queryKeys.likes.status(_id));
      const previousBlogDetail = queryClient.getQueryData(queryKeys.blogs.detail(blogId));

      // Optimistically toggle the like status (cache stores a plain boolean)
      queryClient.setQueryData(queryKeys.likes.status(_id), !isLikedByUser);

      // Optimistically update the like count on the blog detail
      queryClient.setQueryData(queryKeys.blogs.detail(blogId), (old) => {
        if (!old) return old;
        return {
          ...old,
          activity: {
            ...old.activity,
            total_likes: old.activity.total_likes + (isLikedByUser ? -1 : 1),
          },
        };
      });

      return { previousLikeStatus, previousBlogDetail, _id };
    },

    onError: (_error, _variables, context) => {
      if (!context) return;
      // Roll back to the snapshots
      queryClient.setQueryData(
        queryKeys.likes.status(context._id),
        context.previousLikeStatus,
      );
      queryClient.setQueryData(
        queryKeys.blogs.detail(blogId),
        context.previousBlogDetail,
      );
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.likes.status(variables._id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.blogs.detail(blogId) });
      // Invalidate feed queries so total_likes updates in card props
      queryClient.invalidateQueries({ queryKey: queryKeys.blogs.all() });
    },
  });
};
