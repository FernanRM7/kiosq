import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateTenant } from "@/lib/auth";

export function useUpdateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tenant"] });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}
