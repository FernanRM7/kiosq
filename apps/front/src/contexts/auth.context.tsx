import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { getMe } from "@/lib/auth";
import type { MeUser } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthState {
  /**
   * Discriminated status of the current session.
   *
   * - `loading`         — initial hydration in progress (do not redirect yet)
   * - `authenticated`   — valid `wos-session` cookie confirmed by backend
   * - `unauthenticated` — no session or session expired / revoked
   */
  status: AuthStatus;

  /** Authenticated user profile. Only defined when `status === 'authenticated'`. */
  user: MeUser | null;

  /**
   * Re-fetches `/me` to sync the context with the current cookie state.
   * Call this after any action that may have changed the session (e.g. after
   * the backend sets a refreshed cookie).
   */
  refresh: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState | null>(null);
AuthContext.displayName = "AuthContext";

// ─── Provider ─────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provides the global authentication state to the React tree.
 *
 * On mount, it calls `GET /me` to hydrate the session status using the
 * `wos-session` cookie set by the NestJS backend (WorkOS AuthKit).
 *
 * This provider does NOT implement login, registration, or logout.
 * It exclusively manages the read-side of the session lifecycle.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<MeUser | null>(null);

  const hydrate = useCallback(async () => {
    try {
      const result = await getMe();

      if (result?.success) {
        setUser(result.data);
        setStatus("authenticated");
      } else {
        setUser(null);
        setStatus("unauthenticated");
      }
    } catch {
      // Network failure — treat as unauthenticated to avoid infinite loading
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const value = useMemo<AuthState>(
    () => ({ refresh: hydrate, status, user }),
    [status, user, hydrate]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the current authentication state.
 * Must be used inside `<AuthProvider>`.
 */
export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuthContext must be used within <AuthProvider>");
  }

  return ctx;
}
