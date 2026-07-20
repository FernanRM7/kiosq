import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { TeamMember } from "@/hooks/queries/use-team";
import { request } from "@/lib/api";

interface CreateTeamCashierPayload {
  name: string;
  code: string;
  pin: string;
  email?: string;
}

export function useCreateTeamCashier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTeamCashierPayload) =>
      request<TeamMember>("/api/team/cashiers", {
        data,
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
  });
}
