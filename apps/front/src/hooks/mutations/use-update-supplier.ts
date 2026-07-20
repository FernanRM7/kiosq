import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateSupplier } from "@/lib/suppliers";

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      supplierId,
      payload,
    }: {
      supplierId: string;
      payload: Partial<{
        name: string;
        rfc: string | null;
        email: string | null;
        phone: string | null;
        address: string | null;
      }>;
    }) => updateSupplier(supplierId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
}
