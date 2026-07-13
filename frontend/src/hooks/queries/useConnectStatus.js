import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import { UserContext } from '../../App';

/**
 * Fetches the connection status between the current user and `targetUserId`.
 *
 * Possible statuses: `'none'` | `'pending_sent'` | `'pending_received'` | `'accepted'`
 *
 * @param {string} targetUserId — The _id of the target user.
 * @param {string} [initialData] — Optional server-rendered initial status string.
 * @returns {import('@tanstack/react-query').UseQueryResult<string>}
 */
const useConnectStatus = (targetUserId, initialData) => {
  const { userAuth: { access_token, _id: currentUserId } } = useContext(UserContext);

  return useQuery({
    queryKey: queryKeys.connect.status(targetUserId),

    queryFn: async () => {
      const { data } = await api.post('/connect/status', { user_id: targetUserId });
      return data.status;
    },

    enabled: !!access_token && !!targetUserId && targetUserId !== currentUserId,
    staleTime: 10 * 60 * 1000,
    ...(initialData !== undefined && { initialData }),
  });
};

export default useConnectStatus;
