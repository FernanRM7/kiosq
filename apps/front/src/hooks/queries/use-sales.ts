import { useQuery } from "@tanstack/react-query";

import { listSales } from "@/lib/sales";

export function useSales() {
  return useQuery({
    queryFn: listSales,
    queryKey: ["sales"] as const,
  });
}
