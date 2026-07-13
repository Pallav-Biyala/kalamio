import { useContext } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import { UserContext } from '../../App';

/**
 * Fetches a paginated list of a user's blogs.
 *
 * **Two modes:**
 * 1. Profile page — `filters.userId` is set → public search-blogs endpoint.
 * 2. Manage blogs — `filters.draft` is defined → auth-guarded user-written-blogs endpoint.
 *
 * @param {{ userId?: string, draft?: boolean, query?: string, sort?: string }} filters
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult}
 */
const useUserBlogs = (filters = {}) => {
  const { userAuth: { access_token } } = useContext(UserContext);
  const { userId, draft, query, sort } = filters;

  /** Whether we're in "manage my blogs" mode (draft filter is explicitly set). */
  const isManageMode = draft !== undefined;

  return useInfiniteQuery({
    queryKey: queryKeys.blogs.userWritten(filters),

    queryFn: async ({ pageParam = 1 }) => {
      let blogs;
      let totalDocs = null;

      if (isManageMode) {
        // Manage blogs — auth-guarded endpoint
        const { data } = await api.post('/user-written-blogs', {
          page: pageParam,
          draft,
          query,
          sort,
        });
        blogs = data.blogs;

        if (pageParam === 1) {
          const countRes = await api.post('/user-written-blogs-count', { draft, query });
          totalDocs = countRes.data.totalDocs;
        }
      } else {
        // Profile page — public endpoint
        const { data } = await api.post('/search-blogs', {
          author: userId,
          page: pageParam,
        });
        blogs = data.blogs;

        if (pageParam === 1) {
          const countRes = await api.post('/search-blogs-count', { author: userId });
          totalDocs = countRes.data.totalDocs;
        }
      }

      return { blogs, page: pageParam, totalDocs };
    },

    enabled: isManageMode ? !!access_token : !!userId,

    getNextPageParam: (lastPage, allPages) => {
      const totalDocs = allPages[0]?.totalDocs ?? 0;
      const totalLoaded = allPages.reduce((sum, p) => sum + p.blogs.length, 0);
      return totalLoaded < totalDocs ? lastPage.page + 1 : undefined;
    },

    select: (data) => {
      const allBlogs = data.pages.flatMap((p) => p.blogs);
      const totalDocs = data.pages[0]?.totalDocs ?? 0;
      return {
        blogs: allBlogs,
        totalDocs,
        hasMore: allBlogs.length < totalDocs,
        pages: data.pages,
        pageParams: data.pageParams,
      };
    },
  });
};

export default useUserBlogs;
