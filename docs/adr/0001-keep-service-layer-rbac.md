# Keep service-layer RBAC conditionals (no `RolesGuard` yet)

We keep role-based access checks as inline `if (role === "CASHIER") throw new ForbiddenException(...)` calls inside services, rather than introducing a `RolesGuard` with a `@Roles()` decorator. The current pattern scales fine for the small number of role checks we have and mirrors the existing `assertCanManageCatalog` shape. We will revisit a `RolesGuard` migration when a real use case (resource-level permissions, per-request role overrides, custom roles) demands it.

## Status

accepted
