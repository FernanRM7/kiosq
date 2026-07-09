import { useQuery } from "@tanstack/react-query";

import { getActiveSessions } from "@/lib/auth";

export function useSessions() {
  return useQuery({
    queryFn: getActiveSessions,
    queryKey: ["sessions"] as const,
  });
}
