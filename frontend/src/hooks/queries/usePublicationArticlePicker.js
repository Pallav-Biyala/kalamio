import { useContext } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { UserContext } from '../../App';

/**
 * Infinite list of the signed-in user's PUBLISHED articles (type `blog`), each with its current
 * publication populated, for the "add existing articles to a publication" picker.
 *
 * Opts into the server's `with_publication` mode so the payload includes the Mongo `_id` (which
 * /publication/add-blog & /remove-blog key off) and `publication` (to render/toggle membership).
 * Kept OUTSIDE the ['publications'] key namespace so the broad publications invalidation the
 * add/remove mutations fire doesn't refetch (and visually thrash) this list — membership is patched
 * optimistically instead (see usePublicationArticles).
 *
 * @param {{ query?: string, enabled?: boolean }} opts
 */
const usePublicationArticlePicker = ({ query = '', enabled = true } = {}) => {
  const { userAuth: { access_token } } = useContext(UserContext);

  return useInfiniteQuery({
    queryKey: ['publication-article-picker', query],

    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.post('/user-written-blogs', {
        page: pageParam,
        draft: false,
        content_type: 'blog',
        with_publication: true,
        query,
        sort: 'newest',
      });

      let totalDocs = null;
      if (pageParam === 1) {
        const countRes = await api.post('/user-written-blogs-count', {
          draft: false,
          content_type: 'blog',
          query,
        });
        totalDocs = countRes.data.totalDocs;
      }

      return { blogs: data.blogs, page: pageParam, totalDocs };
    },

    enabled: enabled && !!access_token,

    getNextPageParam: (lastPage, allPages) => {
      const totalDocs = allPages[0]?.totalDocs ?? 0;
      const loaded = allPages.reduce((sum, p) => sum + p.blogs.length, 0);
      return loaded < totalDocs ? lastPage.page + 1 : undefined;
    },

    select: (data) => ({
      blogs: data.pages.flatMap((p) => p.blogs),
      totalDocs: data.pages[0]?.totalDocs ?? 0,
    }),
  });
};

export default usePublicationArticlePicker;
