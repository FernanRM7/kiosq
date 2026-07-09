import { useQuery } from "@tanstack/react-query";

import { listProducts } from "@/lib/products";

export function useProducts() {
  return useQuery({
    queryFn: listProducts,
    queryKey: ["products"] as const,
  });
}
