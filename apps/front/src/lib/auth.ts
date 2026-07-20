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
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  name: string;
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
      console.warn("[Auth] Session expired detected");
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

export interface TenantSettingsInput {
  cashOpeningAmount: number;
}

export interface CreateCashierResponse {
  cashierCode: string;
  tenant: MyTenantData | null;
  temporaryPin: string;
}

export interface UpdateCashierResponse {
  cashier: {
    cashierCode: string | null;
    id: string;
    name: string;
  };
  tenant: MyTenantData | null;
  temporaryPin?: string;
}

export interface CashierLoginInput {
  cashierCode: string;
  pin: string;
  tenantSlug: string;
}

export function updateMyTenantSettings(
  data: TenantSettingsInput
): Promise<MyTenantData | null> {
  return request<MyTenantData | null>("/api/tenants/me/settings", {
    data,
    method: "PATCH",
  });
}

export function updateTenant(data: {
  name: string;
}): Promise<{ tenant: MyTenantData | null }> {
  return request<{ tenant: MyTenantData | null }>("/api/tenants/me", {
    data,
    method: "PATCH",
  });
}

export function deleteTenant(data: {
  confirmationName: string;
}): Promise<{ tenant: MyTenantData | null }> {
  return request<{ tenant: MyTenantData | null }>("/api/tenants/me", {
    data,
    method: "DELETE",
  });
}

export function createCashier(data: {
  name: string;
}): Promise<CreateCashierResponse> {
  return request<CreateCashierResponse>("/api/tenants/me/cashiers", {
    data,
    method: "POST",
  });
}

export function updateCashier(
  cashierId: string,
  data: {
    name?: string;
    pin?: string;
  }
): Promise<UpdateCashierResponse> {
  return request<UpdateCashierResponse>(
    `/api/tenants/me/cashiers/${cashierId}`,
    {
      data,
      method: "PATCH",
    }
  );
}

export function cashierLogin(
  data: CashierLoginInput
): Promise<{ redirectTo: string }> {
  return request<{ redirectTo: string }>("/api/auth/cashier/login", {
    data,
    method: "POST",
  });
}

export interface MyTenantData {
  id: string;
  tenantId: string;
  tenant: {
    id: string;
    name: string;
    plan: {
      id: string;
      maxBranches: number;
      maxDevices: number;
      maxUsers: number;
      name: string;
    };
    settings: Record<string, unknown> | null;
    users: {
      cashierCode: string | null;
      cashierShifts: {
        closedAt: string | null;
        closingCash: number | null;
        dailySales: number;
        id: string;
        openingCash: number;
        openedAt: string;
        soldProducts:
          | {
              name: string;
              quantity: number;
              total: number;
            }[]
          | null;
        status: string;
      }[];
      email: string | null;
      id: string;
      isActive: boolean;
      lastLoginAt: string | null;
      name: string;
      role: string;
    }[];
    slug: string;
    planId: string;
    status: string;
  } | null;
  name: string;
  role: string;
  email: string | null;
  workosUserId: string | null;
}

export function getMyTenant(): Promise<MyTenantData | null> {
  return request<MyTenantData | null>("/api/tenants/me");
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
