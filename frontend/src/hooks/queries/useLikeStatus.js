import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import { UserContext } from '../../App';

/**
 * Checks whether the current user has liked a specific blog post.
 *
 * @param {string} blogMongoId — The blog's MongoDB `_id` (not the slug `blog_id`).
 * @returns {import('@tanstack/react-query').UseQueryResult<boolean>}
 */
const useLikeStatus = (blogMongoId) => {
  const { userAuth: { access_token } } = useContext(UserContext);

  return useQuery({
    queryKey: queryKeys.likes.status(blogMongoId),

    queryFn: async () => {
      const { data } = await api.post('/isliked-by-user', { _id: blogMongoId });
      return Boolean(data.result);
    },

    enabled: !!access_token && !!blogMongoId,
    staleTime: 10 * 60 * 1000,
  });
};

export default useLikeStatus;
