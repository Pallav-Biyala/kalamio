import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { UserContext } from '../../App';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Optimistic mutation for deleting a single notification.
 *
 * Removes the notification from the infinite query cache for the current
 * filter tab immediately, and rolls back if the server request fails.
 *
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useDeleteNotification = () => {
  const queryClient = useQueryClient();
  const { userAuth: { access_token } } = useContext(UserContext);

  return useMutation({
    mutationFn: ({ _id }) =>
      api.post('/delete-notification', { _id }),

    onMutate: async ({ _id, filter }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.notifications.list(filter),
      });

      const previousList = queryClient.getQueryData(
        queryKeys.notifications.list(filter),
      );

      // Optimistically remove the notification from the infinite query pages
      queryClient.setQueryData(
        queryKeys.notifications.list(filter),
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              notifications: page.notifications.filter((n) => n._id !== _id),
            })),
          };
        },
      );

      return { previousList, filter };
    },

    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(
        queryKeys.notifications.list(context.filter),
        context.previousList,
      );
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.list(variables.filter),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unread(),
      });
    },
  });
};
