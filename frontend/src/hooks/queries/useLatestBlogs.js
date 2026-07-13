import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Fetches the paginated home feed of latest blogs.
 *
 * - First page also fetches the total count so we can derive `hasNextPage`.
 * - `select` flattens all pages into a single `{ blogs, totalDocs, hasMore }` object.
 *
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult}
 */
const useLatestBlogs = () => {
  return useInfiniteQuery({
    queryKey: queryKeys.blogs.latest(),

    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.post('/latest-blogs', { page: pageParam });

      let totalDocs = null;
      if (pageParam === 1) {
        const countRes = await api.post('/all-latest-blogs-count');
        totalDocs = countRes.data.totalDocs;
      }

      return {
        blogs: data.blogs,
        page: pageParam,
        totalDocs,
      };
    },

    getNextPageParam: (lastPage, allPages) => {
      // totalDocs is only present on the first page
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

export default useLatestBlogs;
