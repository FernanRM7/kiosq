import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createTenant } from "@/lib/auth";

export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tenant"] });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}
