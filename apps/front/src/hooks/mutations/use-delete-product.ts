import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteProduct } from "@/lib/products";

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
