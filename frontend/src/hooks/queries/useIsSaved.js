import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import { UserContext } from '../../App';

/**
 * Checks whether the current user has saved (bookmarked) a blog post.
 *
 * @param {string} blogId — The blog_id slug (not the MongoDB _id).
 * @returns {import('@tanstack/react-query').UseQueryResult<boolean>}
 */
const useIsSaved = (blogId) => {
  const { userAuth: { access_token } } = useContext(UserContext);

  return useQuery({
    queryKey: queryKeys.collections.isSaved(blogId),

    queryFn: async () => {
      const { data } = await api.post('/collection/is-saved', { blog_id: blogId });
      return data.saved;
    },

    enabled: !!access_token && !!blogId,
    staleTime: 10 * 60 * 1000,
  });
};

export default useIsSaved;
