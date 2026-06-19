import { isUnauthenticatedError, request } from "@/lib/api";
import type { ApiSuccess } from "@/lib/api";

export {
  API_BASE_URL,
  ApiClientError,
  isUnauthenticatedError,
} from "@/lib/api";

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

export interface TenantListItem {
  id: string;
  name: string;
  role: string;
  slug: string;
  status: string;
  joinedAt: string;
}

export function listTenants(): Promise<TenantListItem[]> {
  return request<TenantListItem[]>("/api/tenants");
}

export function switchTenant(
  tenantId: string
): Promise<{ tenant: { id: string; name: string; slug: string } }> {
  return request(`/api/tenants/${tenantId}/switch`, {
    method: "POST",
  });
}
