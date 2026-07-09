import { useAuthStore } from "@/stores/auth.store";
import type { AuthState } from "@/stores/auth.store";

export type { AuthState };

export function useAuth(): AuthState {
  return useAuthStore();
}
