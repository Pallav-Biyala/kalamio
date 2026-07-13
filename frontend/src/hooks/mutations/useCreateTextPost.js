import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { UserContext } from '../../App';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import toast from 'react-hot-toast';

/**
 * Mutation for creating (or editing) a text post.
 *
 * Mirrors the payload built by `TextPostComposer.buildPayload()`:
 * ```
 * {
 *   text_content: string,
 *   images: string[],
 *   poll: { question, options: [{ text, votes }], total_votes } | null,
 *   draft: boolean,
 *   publication: string | null,
 *   id?: string   // present when editing an existing post
 * }
 * ```
 *
 * On success invalidates the latest and following feeds so the new post
 * appears in timelines.
 *
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useCreateTextPost = () => {
  const queryClient = useQueryClient();
  const { userAuth: { access_token } } = useContext(UserContext);

  return useMutation({
    mutationFn: (payload) =>
      api.post('/create-text-post', payload),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blogs.latest() });
      queryClient.invalidateQueries({ queryKey: queryKeys.blogs.following() });
    },

    onError: (error) => {
      toast.error(error?.response?.data?.error || 'Failed to create post');
    },
  });
};
