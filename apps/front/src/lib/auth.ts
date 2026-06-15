/**
 * Centralized AuthKit HTTP client.
 *
 * All communication with the NestJS backend related to authentication
 * is funneled through this module. Using a single base URL source
 * ensures Tauri compatibility: swap VITE_API_URL for the desktop
 * environment URL and the rest of the app adapts automatically.
 */

/** Base URL for the NestJS backend. Injected at build time via Vite. */
export const API_BASE_URL =
  (import.meta.env["VITE_API_URL"] as string | undefined) ??
  "http://localhost:3000";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape of the authenticated user returned by GET /me */
export interface MeUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  organizationId: string | undefined;
  role: string | undefined;
}

/** Successful /me response envelope */
export interface MeResponse {
  success: true;
  data: MeUser;
}

// ─── API client ───────────────────────────────────────────────────────────────

/**
 * Lightweight fetch wrapper for auth-related endpoints.
 * Always sends cookies (`credentials: 'include'`) so the
 * `wos-session` HttpOnly cookie is forwarded to the backend.
 */
const authFetch = (path: string, init?: RequestInit): Promise<Response> =>
  fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
  });

/**
 * Retrieves the current user profile from the backend.
 *
 * - Returns `MeResponse` when a valid `wos-session` cookie exists.
 * - Throws on network error.
 * - Returns `null` on any non-2xx status (e.g. 401 Unauthorized).
 */
export async function getMe(): Promise<MeResponse | null> {
  const response = await authFetch("/me");

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<MeResponse>;
}
