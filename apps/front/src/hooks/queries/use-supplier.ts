import { useQuery } from "@tanstack/react-query";

import { getSupplier } from "@/lib/suppliers";

export function useSupplier(supplierId: string) {
  return useQuery({
    enabled: Boolean(supplierId),
    queryFn: () => getSupplier(supplierId),
    queryKey: ["suppliers", supplierId] as const,
  });
}
