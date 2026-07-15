import { useContext } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import { UserContext } from '../../App';

/**
 * Fetches paginated notifications for the current user.
 *
 * @param {string} filter — Filter type: 'all', 'like', 'comment', 'reply', etc.
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult}
 */
const useNotifications = (filter = 'all') => {
  const { userAuth: { access_token } } = useContext(UserContext);

  return useInfiniteQuery({
    queryKey: queryKeys.notifications.list(filter),

    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.post('/notifications', {
        page: pageParam,
        filter,
      });

      let totalDocs = null;
      if (pageParam === 1) {
        const countRes = await api.post('/all-notifications-count', { filter });
        totalDocs = countRes.data.totalDocs;
      }

      return {
        notifications: data.notifications,
        page: pageParam,
        totalDocs,
      };
    },

    enabled: !!access_token,

    // Always refetch on mount: the server marks notifications seen when the list is fetched, so
    // visiting the tab must hit the server (even within staleTime) for the Activity badge to clear.
    refetchOnMount: 'always',

    getNextPageParam: (lastPage, allPages) => {
      const totalDocs = allPages[0]?.totalDocs ?? 0;
      const totalLoaded = allPages.reduce(
        (sum, p) => sum + p.notifications.length,
        0,
      );
      return totalLoaded < totalDocs ? lastPage.page + 1 : undefined;
    },

    select: (data) => {
      const notifications = data.pages.flatMap((p) => p.notifications);
      const totalDocs = data.pages[0]?.totalDocs ?? 0;
      return {
        notifications,
        totalDocs,
        hasMore: notifications.length < totalDocs,
        pages: data.pages,
        pageParams: data.pageParams,
      };
    },
  });
};

export default useNotifications;
