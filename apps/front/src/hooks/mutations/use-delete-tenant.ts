import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteTenant } from "@/lib/auth";

export function useDeleteTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tenant"] });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}
