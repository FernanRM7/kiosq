import { useAuthStore } from "@/stores/auth.store";

export type { AuthState } from "@/stores/auth.store";

export function useAuth() {
  return useAuthStore();
}
