import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import { UserContext } from '../../App';

/**
 * Checks whether the current user is following `targetUserId`.
 *
 * Disabled when not authenticated or when the target is the current user.
 *
 * @param {string}  targetUserId — The _id of the user to check.
 * @param {boolean} [initialData] — Optional server-rendered initial value.
 * @param {{ enabled?: boolean }} [options] — Extra gating, ANDed with the checks below. Lets a
 *   caller defer the request until it's actually needed (e.g. a menu that only opens on click),
 *   instead of firing one per rendered card.
 * @returns {import('@tanstack/react-query').UseQueryResult<boolean>}
 */
const useFollowStatus = (targetUserId, initialData, options = {}) => {
  const { userAuth: { access_token, _id: currentUserId } } = useContext(UserContext);

  return useQuery({
    queryKey: queryKeys.follow.status(targetUserId),

    queryFn: async () => {
      const { data } = await api.post('/is-following', { user_id: targetUserId });
      return data.following;
    },

    enabled:
      (options.enabled ?? true) &&
      !!access_token && !!targetUserId && targetUserId !== currentUserId,
    staleTime: 10 * 60 * 1000,
    // Seed ONLY from a real boolean. A null "unknown" (e.g. batch status still loading)
    // must not seed — else it sticks as a stale falsy value and the real fetch is skipped.
    ...(initialData != null && { initialData }),
  });
};

export default useFollowStatus;
