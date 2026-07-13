import { useQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Searches for users matching the given query string.
 * Returns the full list (no pagination).
 *
 * @param {string} query — The search term.
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
const useSearchUsers = (query) => {
  return useQuery({
    queryKey: queryKeys.users.search(query),

    queryFn: async () => {
      const { data } = await api.post('/search-users', { query });
      return data.users;
    },

    enabled: query !== undefined,
  });
};

export default useSearchUsers;
