import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {},
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 30_000,
    },
  },
});
