import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";

import { request } from "@/lib/api";
import type { TeamMember } from "@/hooks/queries/use-team";

interface CreateCashierPayload {
  name: string;
  code: string;
  pin: string;
  email?: string;
}

export function useCreateCashier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCashierPayload) =>
      request<TeamMember>("/team/cashiers", {
        data,
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
  });
}
