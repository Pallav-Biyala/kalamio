import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../common/api';
import { queryKeys } from '../../common/queryKeys';
import { UserContext } from '../../App';

/**
 * Checks whether the current user is subscribed to a given publication.
 *
 * @param {string}  publicationId — The publication's _id.
 * @param {boolean} [initialData] — Optional server-rendered initial value.
 * @returns {import('@tanstack/react-query').UseQueryResult<boolean>}
 */
const useSubscribeStatus = (publicationId, initialData) => {
  const { userAuth: { access_token } } = useContext(UserContext);

  return useQuery({
    queryKey: queryKeys.subscribe.status(publicationId),

    queryFn: async () => {
      const { data } = await api.post('/is-subscribed', { publication_id: publicationId });
      return data.subscribed;
    },

    enabled: !!access_token && !!publicationId,
    staleTime: 10 * 60 * 1000,
    ...(initialData !== undefined && { initialData }),
  });
};

export default useSubscribeStatus;
