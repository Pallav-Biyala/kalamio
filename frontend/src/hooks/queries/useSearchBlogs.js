import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Fetches paginated blog search results.
 *
 * @param {string} query — The search query string.
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult}
 */
const useSearchBlogs = (query) => {
  return useInfiniteQuery({
    queryKey: queryKeys.blogs.search(query),

    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.post('/search-blogs', {
        query,
        page: pageParam,
      });

      let totalDocs = null;
      if (pageParam === 1) {
        const countRes = await api.post('/search-blogs-count', { query });
        totalDocs = countRes.data.totalDocs;
      }

      return {
        blogs: data.blogs,
        page: pageParam,
        totalDocs,
      };
    },

    enabled: !!query,

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

export default useSearchBlogs;
