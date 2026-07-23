import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Patch a single post's `publication` field in every cached article-picker page, so a row's
 * membership flips instantly without refetching the whole infinite list (which would flash and
 * reset scroll). `publication` is the populated ref { _id, title, slug } on add, or null on remove.
 */
const patchPickerMembership = (queryClient, blogMongoId, publication) => {
  queryClient.setQueriesData({ queryKey: ['publication-article-picker'] }, (old) => {
    if (!old?.pages) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        blogs: page.blogs.map((b) => (b._id === blogMongoId ? { ...b, publication } : b)),
      })),
    };
  });
};

/**
 * Link one of the user's own articles to a publication (also MOVES it if it was in another one —
 * the server decrements the old publication's counter). Optimistically flips the picker row, then
 * invalidates the ['publications'] namespace so every publication feed + the dashboard counts
 * reconcile from the server.
 */
export const useAddArticleToPublication = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ blogMongoId, publicationId }) =>
      api.post('/publication/add-blog', { publication_id: publicationId, blog_id: blogMongoId }),
    onSuccess: (_res, { blogMongoId, publicationRef }) => {
      patchPickerMembership(queryClient, blogMongoId, publicationRef);
      queryClient.invalidateQueries({ queryKey: queryKeys.publications.all() });
    },
  });
};

/** Unlink an article from whatever publication it's currently in (remove-blog needs only its _id). */
export const useRemoveArticleFromPublication = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ blogMongoId }) =>
      api.post('/publication/remove-blog', { blog_id: blogMongoId }),
    onSuccess: (_res, { blogMongoId }) => {
      patchPickerMembership(queryClient, blogMongoId, null);
      queryClient.invalidateQueries({ queryKey: queryKeys.publications.all() });
    },
  });
};
