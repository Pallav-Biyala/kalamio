import { useQuery } from '@tanstack/react-query';
import { useContext } from 'react';
import { UserContext } from '../../App';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Fetches all analytics data in a single query: overview, top posts, and follower growth.
 * Combines three parallel API calls into one query for atomic loading state.
 *
 * @returns {import('@tanstack/react-query').UseQueryResult<{overview: object, topPosts: Array, growth: Array}>}
 */
export const useAnalytics = () => {
  const { userAuth: { access_token } } = useContext(UserContext);

  return useQuery({
    queryKey: queryKeys.analytics.all(),
    queryFn: async () => {
      const [overviewRes, postsRes, growthRes] = await Promise.all([
        api.post('/analytics/overview'),
        api.post('/analytics/top-posts'),
        api.post('/analytics/follower-growth'),
      ]);
      return {
        overview: overviewRes.data,
        topPosts: postsRes.data.posts,
        growth: growthRes.data.growth,
      };
    },
    enabled: !!access_token,
    staleTime: 5 * 60 * 1000,
  });
};
