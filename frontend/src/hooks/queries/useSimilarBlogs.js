import { useQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Fetches up to 6 similar blogs sharing the same primary tag,
 * excluding the current blog.
 *
 * @param {string} blogId    — The blog_id to exclude from results.
 * @param {string[]} tags    — Tags array from the current blog.
 * @returns {import('@tanstack/react-query').UseQueryResult}
 */
const useSimilarBlogs = (blogId, tags) => {
  return useQuery({
    queryKey: queryKeys.blogs.similar(blogId),

    queryFn: async () => {
      const { data } = await api.post('/search-blogs', {
        tag: tags[0],
        limit: 6,
        eliminate_blog: blogId,
      });
      return data.blogs;
    },

    enabled: !!blogId && !!tags?.length,
    staleTime: 15 * 60 * 1000,
  });
};

export default useSimilarBlogs;
