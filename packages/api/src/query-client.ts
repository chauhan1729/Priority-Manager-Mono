import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 min — data is fresh for 1 min before re-fetching
      gcTime: 1000 * 60 * 10, // 10 min — cached in memory
      retry: 2,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
