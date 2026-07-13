import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { UserContext } from '../../App';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Optimistic mutation for voting on a poll.
 *
 * Instantly marks the selected option as voted and reconciles with the
 * server on settle by invalidating both poll-vote and blog-detail caches.
 *
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useVotePoll = () => {
  const queryClient = useQueryClient();
  const { userAuth: { access_token } } = useContext(UserContext);

  return useMutation({
    mutationFn: ({ blogId, optionIndex }) =>
      api.post('/vote-poll', { blog_id: blogId, option_index: optionIndex }),

    onMutate: async ({ blogId, optionIndex }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.polls.voteStatus(blogId),
      });

      const previousVoteStatus = queryClient.getQueryData(
        queryKeys.polls.voteStatus(blogId),
      );

      // Optimistically mark the vote
      queryClient.setQueryData(
        queryKeys.polls.voteStatus(blogId),
        (old) => ({
          ...old,
          hasVoted: true,
          option_index: optionIndex,
        }),
      );

      return { previousVoteStatus, blogId };
    },

    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(
        queryKeys.polls.voteStatus(context.blogId),
        context.previousVoteStatus,
      );
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.polls.voteStatus(variables.blogId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.blogs.detail(variables.blogId),
      });
    },
  });
};
