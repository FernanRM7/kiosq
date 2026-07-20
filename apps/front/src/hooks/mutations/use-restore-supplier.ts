import { useMutation, useQueryClient } from "@tanstack/react-query";

import { restoreSupplier } from "@/lib/suppliers";

export function useRestoreSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
}
