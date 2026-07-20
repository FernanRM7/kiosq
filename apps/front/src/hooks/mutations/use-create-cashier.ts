import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { TeamMember } from "@/hooks/queries/use-team";
import { request } from "@/lib/api";

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
      request<TeamMember>("/api/team/cashiers", {
        data,
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
  });
}
