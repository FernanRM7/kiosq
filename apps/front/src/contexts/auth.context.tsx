import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import {
  checkHealth,
  getAuthorizationUrl,
  getMe,
  logoutSession,
} from "@/lib/auth";
import type { MeUser } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthStatus = "loading" | "authenticated" | "unauthenticated";
type AuthAction = "login" | "register" | "logout" | null;

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

  /** The auth action currently waiting on the backend. */
  pendingAction: AuthAction;

  /** User-facing error produced by login, registration, logout, or hydration. */
  error: string | null;

  /** Starts the WorkOS-hosted login flow through the backend. */
  login: () => Promise<void>;

  /** Starts the WorkOS-hosted registration flow through the backend. */
  register: () => Promise<void>;

  /** Clears the backend session and redirects to the WorkOS logout URL. */
  logout: () => Promise<void>;

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
  const [pendingAction, setPendingAction] = useState<AuthAction>(null);
  const [error, setError] = useState<string | null>(null);

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
    } catch (hydrateError) {
      setUser(null);
      setStatus("unauthenticated");
      setError(
        hydrateError instanceof Error
          ? hydrateError.message
          : "No se pudo validar la sesion."
      );
    }
  }, []);

  const startAuthFlow = useCallback(
    async (action: Exclude<AuthAction, null>) => {
      setPendingAction(action);
      setError(null);

      try {
        try {
          await checkHealth();
        } catch {
          /* health endpoint no es requerido para el flujo auth */
        }

        const authorizationUrl = await getAuthorizationUrl();
        window.location.assign(authorizationUrl);
      } catch (authError) {
        setError(
          authError instanceof Error
            ? authError.message
            : "No se pudo iniciar la autenticacion."
        );
        setPendingAction(null);
      }
    },
    []
  );

  const login = useCallback(() => startAuthFlow("login"), [startAuthFlow]);

  const register = useCallback(
    () => startAuthFlow("register"),
    [startAuthFlow]
  );

  const logout = useCallback(async () => {
    setPendingAction("logout");
    setError(null);

    try {
      const { logoutUrl } = await logoutSession();
      setUser(null);
      setStatus("unauthenticated");
      window.location.assign(logoutUrl);
    } catch (logoutError) {
      setError(
        logoutError instanceof Error
          ? logoutError.message
          : "No se pudo cerrar la sesion."
      );
      setPendingAction(null);
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const value = useMemo<AuthState>(
    () => ({
      error,
      login,
      logout,
      pendingAction,
      refresh: hydrate,
      register,
      status,
      user,
    }),
    [error, login, logout, pendingAction, register, status, user, hydrate]
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
