import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import { UserContext } from '../../App';

/**
 * Checks whether `targetUserId` follows the current user back.
 *
 * @param {string}  targetUserId — The _id of the user to check.
 * @param {boolean} [initialData] — Optional server-rendered initial value.
 * @returns {import('@tanstack/react-query').UseQueryResult<boolean>}
 */
const useFollowsBack = (targetUserId, initialData) => {
  const { userAuth: { access_token } } = useContext(UserContext);

  return useQuery({
    queryKey: queryKeys.follow.followsBack(targetUserId),

    queryFn: async () => {
      const { data } = await api.post('/is-following-back', { user_id: targetUserId });
      return data.is_following_back || data.follows_you;
    },

    enabled: !!access_token && !!targetUserId,
    staleTime: 10 * 60 * 1000,
    ...(initialData !== undefined && { initialData }),
  });
};

export default useFollowsBack;
