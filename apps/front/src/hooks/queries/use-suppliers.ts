import { useQuery } from "@tanstack/react-query";

import { listSuppliers } from "@/lib/suppliers";

export function useSuppliers() {
  return useQuery({
    queryFn: listSuppliers,
    queryKey: ["suppliers"] as const,
  });
}
