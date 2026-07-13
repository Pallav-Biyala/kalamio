import { useQuery } from '@tanstack/react-query';
import { useContext } from 'react';
import { UserContext } from '../../App';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Fetches block status between current user and target user.
 *
 * @param {string} targetUserId - The user ID to check block status for
 * @returns {import('@tanstack/react-query').UseQueryResult<{is_blocked: boolean, direction: string}>}
 */
export const useBlockStatus = (targetUserId) => {
  const { userAuth: { access_token, _id: currentUserId } } = useContext(UserContext);

  return useQuery({
    queryKey: queryKeys.block.status(targetUserId),
    queryFn: async () => {
      const { data } = await api.post('/is-blocked', { user_id: targetUserId });
      return { is_blocked: data.is_blocked, direction: data.direction };
    },
    enabled: !!access_token && !!targetUserId && targetUserId !== currentUserId,
    staleTime: 10 * 60 * 1000,
  });
};
