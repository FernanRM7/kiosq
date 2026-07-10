import { useMutation, useQueryClient } from "@tanstack/react-query";

import { restoreCategory } from "@/lib/categories";

export function useRestoreCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}
