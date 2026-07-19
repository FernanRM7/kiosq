import { useQuery } from "@tanstack/react-query";

import { request } from "@/lib/api";

export interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
}

function fetchTeam(): Promise<TeamMember[]> {
  return request<TeamMember[]>("/api/team/members");
}

export function useTeam() {
  return useQuery({
    queryFn: fetchTeam,
    queryKey: ["team"] as const,
  });
}