import { useQuery } from "@tanstack/react-query";

import { listProducts } from "@/lib/products";

export function useProducts(options?: { enabled?: boolean }) {
  return useQuery({
    enabled: options?.enabled ?? true,
    queryFn: listProducts,
    queryKey: ["products"] as const,
    staleTime: 60_000,
  });
}
