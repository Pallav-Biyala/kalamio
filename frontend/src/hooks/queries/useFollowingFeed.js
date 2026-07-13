import { useContext } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import { UserContext } from '../../App';

/**
 * Fetches the paginated "following" feed — posts from users the current user follows.
 * Auth-guarded: only runs when the user is signed in.
 *
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult}
 */
const useFollowingFeed = () => {
  const { userAuth: { access_token } } = useContext(UserContext);

  return useInfiniteQuery({
    queryKey: queryKeys.blogs.following(),

    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.post('/follow-feed', { page: pageParam });

      let totalDocs = null;
      if (pageParam === 1) {
        const countRes = await api.post('/follow-feed-count');
        totalDocs = countRes.data.totalDocs;
      }

      return {
        blogs: data.blogs,
        page: pageParam,
        totalDocs,
      };
    },

    enabled: !!access_token,

    getNextPageParam: (lastPage, allPages) => {
      const totalDocs = allPages[0]?.totalDocs ?? 0;
      const totalLoaded = allPages.reduce((sum, p) => sum + p.blogs.length, 0);
      return totalLoaded < totalDocs ? lastPage.page + 1 : undefined;
    },

    select: (data) => {
      const blogs = data.pages.flatMap((p) => p.blogs);
      const totalDocs = data.pages[0]?.totalDocs ?? 0;
      return {
        blogs,
        totalDocs,
        hasMore: blogs.length < totalDocs,
        pages: data.pages,
        pageParams: data.pageParams,
      };
    },
  });
};

export default useFollowingFeed;
