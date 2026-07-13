import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Fetches paginated blogs filtered by a category tag.
 *
 * @param {string} tag — The category tag to filter by.
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult}
 */
const useCategoryBlogs = (tag) => {
  return useInfiniteQuery({
    queryKey: queryKeys.blogs.category(tag),

    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.post('/search-blogs', { tag, page: pageParam });

      let totalDocs = null;
      if (pageParam === 1) {
        const countRes = await api.post('/search-blogs-count', { tag });
        totalDocs = countRes.data.totalDocs;
      }

      return {
        blogs: data.blogs,
        page: pageParam,
        totalDocs,
      };
    },

    enabled: !!tag,

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

export default useCategoryBlogs;
