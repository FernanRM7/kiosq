import { AxiosError, create } from "axios";
import type { AxiosRequestConfig } from "axios";

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

const api = create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

async function request<TData>(
  path: string,
  config?: Omit<AxiosRequestConfig, "url">
): Promise<TData> {
  let response;

  try {
    response = await api.request<ApiResponse<TData>>({
      ...config,
      url: path,
    });
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const body = error.response.data as ApiFailure | null;

      throw new ApiClientError(
        body?.error?.message ?? "La solicitud no pudo completarse.",
        { code: body?.error?.code, status: error.response.status }
      );
    }

    throw new ApiClientError(
      "No se pudo conectar con el backend. Verifica que Nest y Redis esten activos.",
      { status: 0 }
    );
  }

  const body = response.data;

  if (body.success !== true) {
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
    data: { name },
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
