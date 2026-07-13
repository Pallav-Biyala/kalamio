import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { UserContext } from '../../App';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Mutation for following or unfollowing a user.
 *
 * Optimistically sets the follow status and invalidates all follow-related
 * queries, the following feed, and user suggestions on settle.
 *
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useFollowUser = () => {
  const queryClient = useQueryClient();
  const { userAuth: { access_token } } = useContext(UserContext);

  return useMutation({
    mutationFn: ({ userId, action }) =>
      api.post(`/${action}`, { user_id: userId }),

    onMutate: async ({ userId, action }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.follow.status(userId) });

      const previousStatus = queryClient.getQueryData(queryKeys.follow.status(userId));

      // Optimistically set the new follow state
      queryClient.setQueryData(queryKeys.follow.status(userId), (old) => ({
        ...old,
        isFollowing: action === 'follow',
      }));

      return { previousStatus, userId };
    },

    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(
        queryKeys.follow.status(context.userId),
        context.previousStatus,
      );
    },

    onSettled: () => {
      // Broad invalidation — wipes all follow queries (status, batch, followsBack)
      queryClient.invalidateQueries({ queryKey: ['follow'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.blogs.following() });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.suggestions() });
    },
  });
};
