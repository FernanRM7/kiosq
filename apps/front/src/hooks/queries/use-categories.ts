import { useQuery } from "@tanstack/react-query";

import { listCategories } from "@/lib/categories";

export function useCategories() {
  return useQuery({
    queryFn: listCategories,
    queryKey: ["categories"] as const,
  });
}
