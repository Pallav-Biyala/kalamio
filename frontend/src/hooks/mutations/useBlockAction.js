import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { UserContext } from '../../App';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import toast from 'react-hot-toast';

/**
 * Maps a block action to its API endpoint.
 * @type {Record<string, string>}
 */
const ACTION_TO_ENDPOINT = {
  block:   '/block-user',
  unblock: '/unblock-user',
};

/**
 * Mutation for blocking or unblocking a user.
 *
 * Invalidates block status, the block list, and the follow status for
 * the targeted user on success — blocking a user may also unfollow them.
 *
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useBlockAction = () => {
  const queryClient = useQueryClient();
  const { userAuth: { access_token } } = useContext(UserContext);

  return useMutation({
    mutationFn: ({ userId, action }) =>
      api.post(ACTION_TO_ENDPOINT[action], { user_id: userId }),

    onSuccess: (_data, variables) => {
      const { userId, action } = variables;
      queryClient.invalidateQueries({ queryKey: queryKeys.block.status(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.block.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.follow.status(userId) });
      toast.success(action === 'block' ? 'User blocked' : 'User unblocked');
    },

    onError: (error) => {
      toast.error(
        error?.response?.data?.error || 'Action failed. Please try again.',
      );
    },
  });
};
