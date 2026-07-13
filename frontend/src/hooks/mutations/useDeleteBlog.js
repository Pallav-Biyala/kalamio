import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { UserContext } from '../../App';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import toast from 'react-hot-toast';

/**
 * Mutation for deleting a single blog post.
 *
 * Performs a broad invalidation of all blog queries on success to ensure
 * every list/feed reflects the deletion.
 *
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useDeleteBlog = () => {
  const queryClient = useQueryClient();
  const { userAuth: { access_token } } = useContext(UserContext);

  return useMutation({
    mutationFn: ({ blog_id }) =>
      api.post('/delete-blog', { blog_id }),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blogs.all() });
      toast.success('Blog deleted successfully');
    },

    onError: (error) => {
      toast.error(
        error?.response?.data?.error || 'Failed to delete blog',
      );
    },
  });
};
