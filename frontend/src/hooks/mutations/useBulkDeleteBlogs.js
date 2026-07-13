import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { UserContext } from '../../App';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import toast from 'react-hot-toast';

/**
 * Mutation for bulk-deleting multiple blog posts at once.
 *
 * Shows a success toast with the count of deleted blogs and performs
 * a broad invalidation of all blog queries.
 *
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useBulkDeleteBlogs = () => {
  const queryClient = useQueryClient();
  const { userAuth: { access_token } } = useContext(UserContext);

  return useMutation({
    mutationFn: ({ blog_ids }) =>
      api.post('/bulk-delete-blogs', { blog_ids }),

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blogs.all() });
      const count = variables.blog_ids.length;
      toast.success(`${count} blog${count !== 1 ? 's' : ''} deleted`);
    },

    onError: (error) => {
      toast.error(
        error?.response?.data?.error || 'Failed to delete blogs',
      );
    },
  });
};
