import { useQuery } from '@tanstack/react-query';
import { useContext } from 'react';
import { UserContext } from '../../App';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Fetches poll voters for a specific blog (creator only).
 *
 * @param {string} blogId - The blog_id to fetch voters for
 * @param {boolean} enabled - Whether to enable the query (e.g., modal is open)
 * @returns {import('@tanstack/react-query').UseQueryResult<{voters: Array, poll: Object}>}
 */
export const usePollVoters = (blogId, enabled = false) => {
  const { userAuth: { access_token } } = useContext(UserContext);

  return useQuery({
    queryKey: queryKeys.polls.voters(blogId),
    queryFn: async () => {
      const { data } = await api.post('/poll-voters', { blog_id: blogId });
      return data;
    },
    enabled: !!access_token && !!blogId && enabled,
  });
};
