import { useQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Fetches a single blog by its `blog_id`.
 *
 * If the server responds with 403 (draft error), the query automatically
 * retries with `{ draft: true, mode: 'edit' }` so the author can still
 * access their own unpublished post.
 *
 * @param {string} blogId — The blog_id slug.
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
const useBlogDetail = (blogId) => {
  return useQuery({
    queryKey: queryKeys.blogs.detail(blogId),

    queryFn: async () => {
      try {
        const { data } = await api.post('/get-blog', { blog_id: blogId });
        return data.blog;
      } catch (err) {
        if (err.response?.status === 403) {
          // Draft blog — retry with elevated access
          const { data } = await api.post('/get-blog', {
            blog_id: blogId,
            draft: true,
            mode: 'edit',
          });
          return data.blog;
        }
        throw err;
      }
    },

    staleTime: 10 * 60 * 1000,
    enabled: !!blogId,
  });
};

export default useBlogDetail;
