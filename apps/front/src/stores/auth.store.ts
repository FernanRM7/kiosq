import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { checkHealth, getAuthorizationUrl, logoutSession } from "@/lib/auth";
import type { MeUser } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";
type AuthAction = "login" | "register" | "logout" | null;

export interface AuthState {
  status: AuthStatus;
  user: MeUser | null;
  pendingAction: AuthAction;
  error: string | null;
  login: () => Promise<void>;
  register: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: MeUser | null) => void;
  setStatus: (status: AuthStatus) => void;
  setError: (error: string | null) => void;
  setPendingAction: (action: AuthAction) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      error: null,
      login: async () => {
        set({ error: null, pendingAction: "login" });

        try {
          try {
            await checkHealth();
          } catch {
            console.warn("[Auth] Health check failed, continuing auth flow");
          }

          const authorizationUrl = await getAuthorizationUrl();
          window.location.assign(authorizationUrl);
        } catch (authError) {
          console.error("[Auth] Auth flow failed", authError);
          set({
            error: "No se pudo iniciar sesión. Intenta de nuevo.",
            pendingAction: null,
          });
        }
      },
      logout: async () => {
        set({ error: null, pendingAction: "logout" });

        console.log("[Auth] Starting logout");

        try {
          const { logoutUrl } = await logoutSession();
          set({ status: "unauthenticated", user: null });
          window.location.assign(logoutUrl);
        } catch (logoutError) {
          console.error("[Auth] Logout failed", logoutError);
          set({
            error:
              logoutError instanceof Error
                ? logoutError.message
                : "No se pudo cerrar la sesion.",
            pendingAction: null,
          });
        }
      },
      pendingAction: null,
      refresh: async () => {
        await queryClient.invalidateQueries({ queryKey: ["me"] });
      },
      register: async () => {
        set({ error: null, pendingAction: "register" });

        try {
          try {
            await checkHealth();
          } catch {
            console.warn("[Auth] Health check failed, continuing auth flow");
          }

          const authorizationUrl = await getAuthorizationUrl();
          window.location.assign(authorizationUrl);
        } catch (authError) {
          console.error("[Auth] Auth flow failed", authError);
          set({
            error: "No se pudo registrar la cuenta. Intenta de nuevo.",
            pendingAction: null,
          });
        }
      },
      setError: (error) => set({ error }),
      setPendingAction: (action) => set({ pendingAction: action }),
      setStatus: (status) => set({ status }),
      setUser: (user) => set({ user }),
      status: "loading",
      user: null,
    }),
    { name: "auth-store" }
  )
);
