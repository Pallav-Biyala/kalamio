import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import { UserContext } from '../../App';

/**
 * Batch-checks which blogs (by _id) the current user has liked.
 *
 * Returns an array of _id strings that the user has liked.
 *
 * @param {string[]} blogIds — Array of blog MongoDB `_id` strings.
 * @returns {import('@tanstack/react-query').UseQueryResult<string[]>}
 */
const useBatchLikeStatus = (blogIds) => {
  const { userAuth: { access_token } } = useContext(UserContext);

  return useQuery({
    queryKey: queryKeys.likes.batch(blogIds),

    queryFn: async () => {
      const { data } = await api.post('/batch-isliked', { blog_ids: blogIds });
      return data.likedBlogs || [];
    },

    enabled: !!access_token && blogIds?.length > 0,
  });
};

export default useBatchLikeStatus;
