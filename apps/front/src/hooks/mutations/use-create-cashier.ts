import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createCashier } from "@/lib/auth";

export function useCreateCashier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCashier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tenant"] });
    },
  });
}
