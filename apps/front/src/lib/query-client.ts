import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {},
    queries: {
      refetchOnWindowFocus: true,
      retry: 2,
      staleTime: 30_000,
    },
  },
});
