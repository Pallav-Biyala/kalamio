import { useQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Fetches a public user profile by username.
 *
 * @param {string} username — The target user's username.
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
const useUserProfile = (username) => {
  return useQuery({
    queryKey: queryKeys.users.profile(username),

    queryFn: async () => {
      const { data } = await api.post('/get-profile', { username });
      return data;
    },

    enabled: !!username,
    staleTime: 10 * 60 * 1000,
  });
};

export default useUserProfile;
