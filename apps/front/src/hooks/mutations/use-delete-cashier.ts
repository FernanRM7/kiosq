import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteCashier } from "@/lib/auth";

export function useDeleteCashier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteCashier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tenant"] });
    },
  });
}
