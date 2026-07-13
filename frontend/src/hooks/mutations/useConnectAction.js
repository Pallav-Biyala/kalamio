import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { UserContext } from '../../App';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Maps a connection action to the expected resulting status.
 * @type {Record<string, string>}
 */
const ACTION_TO_STATUS = {
  send:     'pending_sent',
  withdraw: 'none',
  accept:   'accepted',
  decline:  'none',
  remove:   'none',
};

/**
 * Maps a connection action to its API endpoint.
 * @type {Record<string, string>}
 */
const ACTION_TO_ENDPOINT = {
  send:     '/connect/send',
  withdraw: '/connect/withdraw',
  accept:   '/connect/accept',
  decline:  '/connect/decline',
  remove:   '/connect/remove',
};

/**
 * Mutation for connection actions (send, withdraw, accept, decline, remove).
 *
 * Optimistically updates the connection status to the expected state.
 * On error, rolls back and refetches the actual status from the server
 * to ensure the cache reflects reality.
 *
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useConnectAction = () => {
  const queryClient = useQueryClient();
  const { userAuth: { access_token } } = useContext(UserContext);

  return useMutation({
    mutationFn: ({ userId, action }) =>
      api.post(ACTION_TO_ENDPOINT[action], { user_id: userId }),

    onMutate: async ({ userId, action }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.connect.status(userId),
      });

      const previousStatus = queryClient.getQueryData(
        queryKeys.connect.status(userId),
      );

      // Optimistically set the new connection status
      queryClient.setQueryData(
        queryKeys.connect.status(userId),
        (old) => ({
          ...old,
          status: ACTION_TO_STATUS[action],
        }),
      );

      return { previousStatus, userId };
    },

    onError: (_error, variables, context) => {
      if (!context) return;

      // Roll back to previous snapshot
      queryClient.setQueryData(
        queryKeys.connect.status(context.userId),
        context.previousStatus,
      );

      // Refetch the actual status from the server to stay accurate
      queryClient.invalidateQueries({
        queryKey: queryKeys.connect.status(context.userId),
      });
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.connect.status(variables.userId),
      });
    },
  });
};
