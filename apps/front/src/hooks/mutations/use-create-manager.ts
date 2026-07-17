import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

import { request } from "@/lib/api";

interface CreateManagerPayload {
  email: string;
}

export function useCreateManager() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateManagerPayload) =>
      request<{ id: string; email: string; role: string; status: string }>(
        "/api/team/managers",
        { data, method: "POST" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
  });
}
