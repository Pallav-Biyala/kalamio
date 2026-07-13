import { useInfiniteQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';

/**
 * Fetches a single collection and its paginated articles.
 *
 * API contract (from collection.page.jsx):
 *   POST `/collection/get` with `{ collection_id, page }`
 *   → `{ collection, articles, totalDocs }`
 *
 * @param {string} collectionId — The collection's _id.
 * @returns {import('@tanstack/react-query').UseInfiniteQueryResult}
 */
const useCollectionDetail = (collectionId) => {
  return useInfiniteQuery({
    queryKey: queryKeys.collections.detail(collectionId),

    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await api.post('/collection/get', {
        collection_id: collectionId,
        page: pageParam,
      });

      return {
        collection: data.collection,
        articles: data.articles,
        totalDocs: data.totalDocs,
        page: pageParam,
      };
    },

    enabled: !!collectionId,

    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.reduce((sum, p) => sum + p.articles.length, 0);
      return totalLoaded < lastPage.totalDocs ? lastPage.page + 1 : undefined;
    },

    select: (data) => {
      const articles = data.pages.flatMap((p) => p.articles);
      // Collection metadata comes from the latest page (always the same object)
      const collection = data.pages[data.pages.length - 1]?.collection ?? null;
      const totalDocs = data.pages[0]?.totalDocs ?? 0;
      return {
        collection,
        articles,
        totalDocs,
        hasMore: articles.length < totalDocs,
        pages: data.pages,
        pageParams: data.pageParams,
      };
    },
  });
};

export default useCollectionDetail;
