import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/hooks/use-auth";

/**
 * Route guard for authenticated sections of the application.
 *
 * Place this as the `element` of a `<Route>` wrapper to protect
 * all nested routes from unauthenticated access.
 *
 * Behavior:
 * - `loading`         → renders `null` (avoids premature redirect during hydration)
 * - `unauthenticated` → redirects to `/login` (replace prevents back-button loop)
 * - `authenticated`   → renders `<Outlet />` (child routes proceed normally)
 *
 * @example
 * ```tsx
 * <Route element={<ProtectedRoute />}>
 *   <Route path="/dashboard" element={<DashboardLayout />} />
 * </Route>
 * ```
 */
export function ProtectedRoute() {
  const { status } = useAuth();

  if (status === "loading") {
    // Do not redirect while the session is being hydrated from the cookie.
    // Returning null prevents a flash of the login page for authenticated users.
    return null;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
