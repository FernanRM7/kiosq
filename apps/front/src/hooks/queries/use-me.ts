import { useQuery } from "@tanstack/react-query";

import { getMe } from "@/lib/auth";

export function useMe() {
  return useQuery({
    queryFn: getMe,
    queryKey: ["me"] as const,
  });
}
