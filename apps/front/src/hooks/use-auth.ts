import { useAuthContext } from "@/contexts/auth.context";
import type { AuthState } from "@/contexts/auth.context";

/**
 * Returns the current authentication state from the nearest `<AuthProvider>`.
 *
 * @example
 * ```tsx
 * const { status, user } = useAuth();
 *
 * if (status === 'loading') return <Spinner />;
 * if (status === 'unauthenticated') return null;
 *
 * return <p>Hello, {user?.firstName}</p>;
 * ```
 *
 * @throws {Error} When used outside of `<AuthProvider>`
 */
export function useAuth(): AuthState {
  return useAuthContext();
}
