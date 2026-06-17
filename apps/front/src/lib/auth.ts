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
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiSuccess<TData> {
  success: true;
  data: TData;
}

interface ApiFailure {
  success: false;
  error?: {
    code?: string;
    message?: string;
    statusCode?: number;
  };
}

type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, options: { code?: string; status: number }) {
    super(message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
  }
}

/** Shape of GET /health data. */
export interface HealthStatus {
  status: "ok";
  timestamp: string;
}

/** Shape of the authenticated user returned by GET /me */
export interface MeUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  organizationId: string | undefined;
  role: string | undefined;
}

/** Successful /me response envelope */
export type MeResponse = ApiSuccess<MeUser>;

export interface AuthorizationUrlData {
  authorizationUrl: string;
}

export interface LogoutData {
  logoutUrl: string;
}

/** Active session metadata from Redis */
export interface ActiveSession {
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  deviceInfo: string;
  ipAddress: string;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
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

function parseApiResponse<TData>(
  response: Response
): Promise<ApiResponse<TData> | null> {
  if (response.status === 204) {
    return Promise.resolve(null);
  }

  return response.json() as Promise<ApiResponse<TData>>;
}

async function request<TData>(
  path: string,
  init?: RequestInit
): Promise<TData> {
  let response: Response;

  try {
    response = await authFetch(path, init);
  } catch {
    throw new ApiClientError(
      "No se pudo conectar con el backend. Verifica que Nest y Redis esten activos.",
      { status: 0 }
    );
  }

  const body = await parseApiResponse<TData>(response);

  if (!response.ok || body?.success === false) {
    throw new ApiClientError(
      body?.success === false && body.error?.message
        ? body.error.message
        : "La solicitud no pudo completarse.",
      {
        code: body?.success === false ? body.error?.code : undefined,
        status: response.status,
      }
    );
  }

  if (!body || body.success !== true) {
    throw new ApiClientError("El backend devolvio una respuesta inesperada.", {
      status: response.status,
    });
  }

  return body.data;
}

export function isUnauthenticatedError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 401;
}

export function checkHealth(): Promise<HealthStatus> {
  return request<HealthStatus>("/api/health");
}

export async function getAuthorizationUrl(): Promise<string> {
  const data = await request<AuthorizationUrlData>("/api/auth/login");

  return data.authorizationUrl;
}

export function logoutSession(): Promise<LogoutData> {
  return request<LogoutData>("/api/auth/logout", { method: "POST" });
}

/**
 * Retrieves the current user profile from the backend.
 *
 * - Returns `MeResponse` when a valid `wos-session` cookie exists.
 * - Throws on network error.
 * - Returns `null` on any non-2xx status (e.g. 401 Unauthorized).
 */
export async function getMe(): Promise<MeResponse | null> {
  try {
    const data = await request<MeUser>("/api/me");

    return { data, success: true };
  } catch (error) {
    if (isUnauthenticatedError(error)) {
      return null;
    }

    throw error;
  }
}

/** Retrieves all active sessions for the current user. */
export function getActiveSessions(): Promise<ActiveSession[]> {
  return request<ActiveSession[]>("/api/me/sessions");
}

/** Revokes a specific session by ID. Returns false if it was the current session. */
export function revokeSession(
  sessionId: string
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/me/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export function createTenant(
  name: string
): Promise<{ tenant: { id: string; name: string; slug: string } }> {
  return request("/api/tenants", {
    body: JSON.stringify({ name }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

export interface MyTenantData {
  id: string;
  tenantId: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    planId: string;
    status: string;
  } | null;
  name: string;
  role: string;
  email: string | null;
  workosUserId: string | null;
}

export function getMyTenant(): Promise<MyTenantData> {
  return request("/api/tenants/me");
}
