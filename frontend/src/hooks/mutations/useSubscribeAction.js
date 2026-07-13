import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { UserContext } from '../../App';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Mutation for subscribing or unsubscribing to a publication.
 *
 * Optimistically toggles the subscription status and invalidates both
 * subscribe.status and publications.detail on settle.
 *
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useSubscribeAction = () => {
  const queryClient = useQueryClient();
  const { userAuth: { access_token } } = useContext(UserContext);

  return useMutation({
    mutationFn: ({ publicationId, action }) =>
      api.post(`/${action}`, { publication_id: publicationId }),

    onMutate: async ({ publicationId, action }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.subscribe.status(publicationId),
      });

      const previousStatus = queryClient.getQueryData(
        queryKeys.subscribe.status(publicationId),
      );

      // Optimistically update subscription status
      queryClient.setQueryData(
        queryKeys.subscribe.status(publicationId),
        (old) => ({
          ...old,
          isSubscribed: action === 'subscribe',
        }),
      );

      return { previousStatus, publicationId };
    },

    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(
        queryKeys.subscribe.status(context.publicationId),
        context.previousStatus,
      );
    },

    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.subscribe.status(variables.publicationId),
      });
      // publications.detail is keyed by SLUG, but we only have the id here, so a
      // detail(id) key would never match. Invalidate the ['publications'] prefix
      // instead — this catches the detail query (any slug) and publication lists
      // so subscriber counts refresh after (un)subscribing.
      queryClient.invalidateQueries({
        queryKey: queryKeys.publications.all(),
      });
    },
  });
};
