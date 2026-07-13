import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContext } from 'react';
import { UserContext } from '../../App';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import toast from 'react-hot-toast';

/**
 * Mutation for creating a new collection.
 *
 * Invalidates the user's collection list on success so the new collection
 * appears immediately.
 *
 * @param {string} username - The current user's username (for cache key).
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useCreateCollection = (username) => {
  const queryClient = useQueryClient();
  const { userAuth: { access_token } } = useContext(UserContext);

  return useMutation({
    mutationFn: ({ title, visibility }) =>
      api.post('/collection/create', { title, visibility }),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.user(username) });
      toast.success('Collection created');
    },

    onError: (error) => {
      toast.error(error?.response?.data?.error || 'Failed to create collection');
    },
  });
};

/**
 * Mutation for deleting a collection.
 *
 * Invalidates the user's collection list on success.
 *
 * @param {string} username - The current user's username (for cache key).
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useDeleteCollection = (username) => {
  const queryClient = useQueryClient();
  const { userAuth: { access_token } } = useContext(UserContext);

  return useMutation({
    mutationFn: ({ collection_id }) =>
      api.post('/collection/delete', { collection_id }),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.user(username) });
      toast.success('Collection deleted');
    },

    onError: (error) => {
      toast.error(error?.response?.data?.error || 'Failed to delete collection');
    },
  });
};

/**
 * Mutation for saving (adding) a blog to a collection.
 *
 * The save-modal component uses `/collection/add-article` and
 * `/collection/remove-article` for toggling. This hook covers the
 * add-article side and invalidates both `isSaved` and `collections.detail`.
 *
 * @returns {import('@tanstack/react-query').UseMutationResult}
 */
export const useSaveToCollection = () => {
  const queryClient = useQueryClient();
  const { userAuth: { access_token } } = useContext(UserContext);

  return useMutation({
    mutationFn: ({ blog_id, collection_id }) =>
      api.post('/collection/save', { blog_id, collection_id }),

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.collections.isSaved(variables.blog_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.collections.detail(variables.collection_id),
      });
    },

    onError: (error) => {
      toast.error(error?.response?.data?.error || 'Failed to save to collection');
    },
  });
};
