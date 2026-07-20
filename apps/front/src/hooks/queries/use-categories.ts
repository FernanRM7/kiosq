import { useQuery } from "@tanstack/react-query";

import { listCategories } from "@/lib/categories";

export function useCategories(options?: { enabled?: boolean }) {
  return useQuery({
    enabled: options?.enabled ?? true,
    queryFn: listCategories,
    queryKey: ["categories"] as const,
    staleTime: 60_000,
  });
}
