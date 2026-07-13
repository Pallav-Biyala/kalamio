import { useQuery } from '@tanstack/react-query';
import { useContext } from 'react';
import { UserContext } from '../../App';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Fetches poll vote status for the current user on a specific blog.
 *
 * @param {string} blogId - The blog_id to check vote status for
 * @returns {import('@tanstack/react-query').UseQueryResult<{hasVoted: boolean, option_index: number|null}>}
 */
export const usePollVoteStatus = (blogId) => {
  const { userAuth: { access_token } } = useContext(UserContext);

  return useQuery({
    queryKey: queryKeys.polls.voteStatus(blogId),
    queryFn: async () => {
      const { data } = await api.post('/check-poll-vote', { blog_id: blogId });
      return { hasVoted: data.hasVoted, option_index: data.option_index };
    },
    enabled: !!access_token && !!blogId,
  });
};
