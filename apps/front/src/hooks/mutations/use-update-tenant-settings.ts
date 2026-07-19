import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateMyTenantSettings } from "@/lib/auth";

export function useUpdateTenantSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMyTenantSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tenant"] });
    },
  });
}
