import { useQuery } from "@tanstack/react-query";

import { getMyTenant, listTenants } from "@/lib/auth";

export function useMyTenant(enabled = true) {
  return useQuery({
    enabled,
    queryFn: getMyTenant,
    queryKey: ["my-tenant"] as const,
    staleTime: 5 * 60_000,
  });
}

export function useTenants(enabled = true) {
  return useQuery({
    enabled,
    queryFn: listTenants,
    queryKey: ["tenants"] as const,
    staleTime: 5 * 60_000,
  });
}
