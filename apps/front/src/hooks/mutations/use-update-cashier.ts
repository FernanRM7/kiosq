import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateCashier } from "@/lib/auth";

export function useUpdateCashier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      cashierId,
      data,
    }: {
      cashierId: string;
      data: {
        name?: string;
        pin?: string;
      };
    }) => updateCashier(cashierId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tenant"] });
    },
  });
}
