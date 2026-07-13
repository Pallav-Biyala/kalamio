import { useQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Fetches the trending blogs list (no pagination).
 * Data is considered fresh for 10 minutes.
 *
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
const useTrendingBlogs = () => {
  return useQuery({
    queryKey: queryKeys.blogs.trending(),

    queryFn: async () => {
      const { data } = await api.get('/trending-blogs');
      return data.blogs;
    },

    staleTime: 10 * 60 * 1000,
  });
};

export default useTrendingBlogs;
