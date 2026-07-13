import { useQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Fetches the list of publications owned by a given user.
 *
 * @param {string} userId — The user's _id.
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
const useUserPublications = (userId) => {
  return useQuery({
    queryKey: queryKeys.publications.user(userId),

    queryFn: async () => {
      const { data } = await api.post('/user-publications', { user_id: userId });
      return data.publications;
    },

    enabled: !!userId,
  });
};

export default useUserPublications;
