import { useQuery } from "@tanstack/react-query";

import { listSales } from "@/lib/sales";

export function useSales(options?: { enabled?: boolean }) {
  return useQuery({
    enabled: options?.enabled ?? true,
    queryFn: listSales,
    queryKey: ["sales"] as const,
    staleTime: 60_000,
  });
}
