import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadLikeStatus } from '../../common/likeStatusLoader';
import { queryKeys } from '../../common/queryKeys';
import { UserContext } from '../../App';

/**
 * Checks whether the current user has liked a specific blog post.
 *
 * The fetch is routed through a batched loader, so many cards asking at once
 * (a feed render) collapse into a single POST /batch-isliked. The per-blog cache
 * key is unchanged, so optimistic like mutations still target likes.status(id).
 *
 * @param {string} blogMongoId — The blog's MongoDB `_id` (not the slug `blog_id`).
 * @returns {import('@tanstack/react-query').UseQueryResult<boolean>}
 */
const useLikeStatus = (blogMongoId) => {
  const { userAuth: { access_token } } = useContext(UserContext);

  return useQuery({
    queryKey: queryKeys.likes.status(blogMongoId),

    queryFn: () => loadLikeStatus(blogMongoId),

    enabled: !!access_token && !!blogMongoId,
    staleTime: 10 * 60 * 1000,
  });
};

export default useLikeStatus;
