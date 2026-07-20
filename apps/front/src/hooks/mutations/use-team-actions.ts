import { useMutation, useQueryClient } from "@tanstack/react-query";

import { request } from "@/lib/api";

export function useDisableMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      request<{ success: boolean }>(`/api/team/members/${userId}/disable`, {
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });
}

export function useEnableMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      request<{ success: boolean }>(`/api/team/members/${userId}/enable`, {
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });
}

export function useCancelInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      request<{ success: boolean }>(`/api/team/members/${userId}/cancel`, {
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });
}

export function useRevokeCashierSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      request<{ success: boolean }>(
        `/api/team/members/${userId}/revoke-sessions`,
        { method: "POST" }
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team"] }),
  });
}
