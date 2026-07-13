import { useContext } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import { UserContext } from '../../App';

/**
 * Fetches the paginated list of users blocked by the current user.
 *
 * API contract (from blocked-users.page.jsx):
 *   POST `/blocked-users` with `{ page }` → `{ users: [{ blocked, blockedAt }] }`
 *   POST `/blocked-users-count` → `{ totalDocs }`
 *
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult}
 */
const useBlockedUsers = () => {
  const { userAuth: { access_token } } = useContext(UserContext);

  return useInfiniteQuery({
    queryKey: queryKeys.block.list(),

    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.post('/blocked-users', { page: pageParam });

      let totalDocs = null;
      if (pageParam === 1) {
        const countRes = await api.post('/blocked-users-count');
        totalDocs = countRes.data.totalDocs;
      }

      return {
        users: data.users,
        page: pageParam,
        totalDocs,
      };
    },

    enabled: !!access_token,

    getNextPageParam: (lastPage, allPages) => {
      const totalDocs = allPages[0]?.totalDocs ?? 0;
      const totalLoaded = allPages.reduce((sum, p) => sum + p.users.length, 0);
      return totalLoaded < totalDocs ? lastPage.page + 1 : undefined;
    },

    select: (data) => {
      const users = data.pages.flatMap((p) => p.users);
      const totalDocs = data.pages[0]?.totalDocs ?? 0;
      return {
        users,
        totalDocs,
        hasMore: users.length < totalDocs,
        pages: data.pages,
        pageParams: data.pageParams,
      };
    },
  });
};

export default useBlockedUsers;
