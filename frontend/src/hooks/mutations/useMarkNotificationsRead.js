import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { UserContext } from '../../App';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import toast from 'react-hot-toast';

/**
 * Mutation for marking all notifications as read.
 *
 * Invalidates the entire notifications key tree so list, unread count,
 * and any other notification queries are refreshed.
 *
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useMarkNotificationsRead = () => {
  const queryClient = useQueryClient();
  const { userAuth: { access_token } } = useContext(UserContext);

  return useMutation({
    mutationFn: () =>
      api.post('/mark-all-notifications-read'),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
      toast.success('All notifications marked as read');
    },

    onError: (error) => {
      toast.error(
        error?.response?.data?.error || 'Failed to mark notifications as read',
      );
    },
  });
};
