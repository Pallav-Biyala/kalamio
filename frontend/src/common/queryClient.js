import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,       // 2 min — data considered fresh
      gcTime: 30 * 60 * 1000,          // 30 min — unused cache kept in memory
      retry: 1,                         // 1 retry — Axios interceptor handles 401/refresh
      refetchOnWindowFocus: 'always',   // Refetch on every tab switch for cross-tab consistency
      refetchOnReconnect: true,         // Refetch when coming back online
      throwOnError: false,              // Let components handle via isError
      networkMode: 'online',            // Don't attempt fetches while offline
    },
    mutations: {
      retry: 0,                         // Never auto-retry mutations
      networkMode: 'online',
    },
  },
});
