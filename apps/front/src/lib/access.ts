import type { MeUser } from "@/lib/auth";

export const roleOrder = [
  "CASHIER",
  "MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

export type AppRole = (typeof roleOrder)[number];

export type RoleLevel = "dependiente" | "dueno" | "admin";

export function normalizeRole(role?: MeUser["role"] | string | null): AppRole {
  const normalizedRole = role?.toUpperCase();

  if (!normalizedRole) {
    return "CASHIER";
  }

  if (normalizedRole === "CASHIER" || normalizedRole === "DEPENDIENTE") {
    return "CASHIER";
  }

  if (
    normalizedRole === "MANAGER" ||
    normalizedRole === "OWNER" ||
    normalizedRole === "MEMBER"
  ) {
    return "MANAGER";
  }

  if (normalizedRole === "SUPER_ADMIN") {
    return "SUPER_ADMIN";
  }

  if (normalizedRole === "ADMIN") {
    return "ADMIN";
  }

  return "CASHIER";
}

export function getRoleLevel(role?: MeUser["role"] | string | null): RoleLevel {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "CASHIER") {
    return "dependiente";
  }

  if (normalizedRole === "MANAGER") {
    return "dueno";
  }

  return "admin";
}

export function getRoleLabel(role?: MeUser["role"] | string | null): string {
  const level = getRoleLevel(role);

  if (level === "dependiente") {
    return "Dependiente";
  }

  if (level === "dueno") {
    return "Dueño";
  }

  return "Admin";
}

export function hasRoleAccess(
  role: MeUser["role"] | string | null | undefined,
  allowedRoles: readonly AppRole[]
): boolean {
  return allowedRoles.includes(normalizeRole(role));
}

export function canManageCatalog(
  role?: MeUser["role"] | string | null
): boolean {
  return hasRoleAccess(role, ["MANAGER", "ADMIN", "SUPER_ADMIN"]);
}

export function canManageSettings(
  role?: MeUser["role"] | string | null
): boolean {
  return hasRoleAccess(role, ["ADMIN", "SUPER_ADMIN"]);
}

export function canSwitchWorkspace(
  role?: MeUser["role"] | string | null
): boolean {
  return hasRoleAccess(role, ["MANAGER", "ADMIN", "SUPER_ADMIN"]);
}
