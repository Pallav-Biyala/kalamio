import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import { UserContext } from '../../App';

/**
 * Batch-checks follow relationships for a list of user IDs.
 *
 * Returns `{ following: [...ids], followers: [...ids] }` indicating which
 * of the given users the current user follows / is followed by.
 *
 * @param {string[]} userIds — Array of user _id strings.
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
const useBatchFollowStatus = (userIds) => {
  const { userAuth: { access_token } } = useContext(UserContext);

  return useQuery({
    queryKey: queryKeys.follow.batchStatus(userIds),

    queryFn: async () => {
      const { data } = await api.post('/batch-follow-status', { user_ids: userIds });
      return { following: data.following, followers: data.followers };
    },

    enabled: !!access_token && userIds?.length > 0,
  });
};

export default useBatchFollowStatus;
