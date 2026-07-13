import { useQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Fetches all collections belonging to a given user.
 *
 * @param {string} username — The target user's username.
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
const useUserCollections = (username) => {
  return useQuery({
    queryKey: queryKeys.collections.user(username),

    queryFn: async () => {
      const { data } = await api.post('/collection/user-collections', { username });
      return data.collections;
    },

    enabled: !!username,
  });
};

export default useUserCollections;
