import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import { UserContext } from '../../App';

/**
 * The current user's collections, each annotated with whether it contains a given article.
 *
 * Cached so both the post menu's saved indicator and the Save modal read the same data — fetching it
 * once when the three-dot menu opens means the modal opens instantly from cache instead of showing a
 * loading spinner while it hits the network.
 *
 * @param {string} blogId — The blog_id slug (not the MongoDB _id).
 * @param {{ enabled?: boolean }} [opts]
 */
const useArticleCollections = (blogId, { enabled = true } = {}) => {
  const { userAuth: { access_token } } = useContext(UserContext);

  return useQuery({
    queryKey: queryKeys.collections.forArticle(blogId),
    queryFn: async () => {
      const { data } = await api.post('/collection/article-collections', { blog_id: blogId });
      return data.collections || [];
    },
    enabled: enabled && !!access_token && !!blogId,
    staleTime: 30 * 1000,
  });
};

export default useArticleCollections;
