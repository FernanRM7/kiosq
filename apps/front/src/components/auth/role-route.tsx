import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/hooks/use-auth";
import { hasRoleAccess } from "@/lib/access";
import type { AppRole } from "@/lib/access";

interface RoleRouteProps {
  allowedRoles: readonly AppRole[];
  redirectTo?: string;
}

export function RoleRoute({
  allowedRoles,
  redirectTo = "/dashboard",
}: RoleRouteProps) {
  const { status, user } = useAuth();

  if (status === "loading") {
    return null;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (!hasRoleAccess(user?.role, allowedRoles)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
