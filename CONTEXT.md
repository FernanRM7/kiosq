# Kiosq

Domain glossary for the kiosq monorepo. Terms specific to this codebase, not general programming concepts.

## Identity & access

**User**:
A row in the `users` table. Identifies a person by email within a tenant. May or may not have a WorkOS account; may or may not have a PIN.
_Avoid_: account, member (a user is not the same as their membership in a workspace).

**Member**:
A row in the `user_tenants` join table. The belonging of a user to a workspace, scoped with role and status. A user can be a member of multiple workspaces; a cashier is a member of exactly one.
_Avoid_: user (the user is the identity, the member is the relationship).

**Workspace**:
Synonym for `tenant`. The boundary inside which sales, products, users and operations live. Each workspace has its own data and its own user list.
_Avoid_: tenant in user-facing copy; org, organization (we map to WorkOS org internally but the user-facing concept is "tu tienda").

**Manager**:
A member of a workspace whose `Role` is `MANAGER` (or higher) and whose `workosUserId` is set. Authenticates via WorkOS SSO. Can administer the catalog and (if ADMIN+) the team.
_Avoid_: owner (we don't use the WorkOS "owner" concept in the local role model).

**Cashier**:
A member of a workspace whose `Role` is `CASHIER` and whose `pinHash` is set. Authenticates via PIN at the kiosk. Cannot switch workspaces, cannot administer the catalog, cannot administer the team.
_Avoid_: empleado, seller (cashier is the canonical term; the UI label is "Dependiente").

**PIN**:
The 4-6 digit numeric credential of a cashier. Hashed with bcrypt and stored in `User.pinHash`. The cleartext PIN is communicated to the cashier out-of-band by the admin who created them.

## Membership lifecycle

**Pending invite**:
A `UserTenant` row with `status = PENDING`. The user has been pre-created in our database by an admin but has not yet completed registration with WorkOS. Visible in the team list with a "pending" indicator.
_Avoid_: invited user (the user exists; what is pending is the activation of the membership).

**Active member**:
A `UserTenant` row with `status = ACTIVE`. The user can authenticate to the workspace and act according to their role.
_Avoid_: enabled user (we use `isActive` on the User table for a different concern — a global kill switch — not for membership state).

**Disabled member**:
A `UserTenant` row with `status = DISABLED`. Was once active; can no longer authenticate. Historical records (sales, movements) are preserved.
_Avoid_: deleted user (we soft-delete, never hard-delete a user that has historical activity).

## Authentication sessions

**WorkOS session**:
The session established by the standard WorkOS AuthKit flow. Stored in the `wos-session` cookie as a sealed envelope (`iron-webcrypto` with `~2` suffix). Validated by `AuthGuard` when this cookie is present.

**Cashier session**:
The session established by the PIN login flow. Stored in the `cashier-session` cookie as an opaque session id. State (userId, tenantId) lives in Redis under `cashier_session:{sessionId}`. Persistent (no TTL by default). Validated by `AuthGuard` when the `wos-session` cookie is absent or invalid.

## Devices

**Kiosk**:
A physical or virtual device dedicated to one workspace where a cashier logs in via PIN. Configured with the workspace slug at install time. The cashier login flow is what the kiosk shows by default; the WorkOS login URL is not surfaced here.
_Avoid_: POS device, terminal (we use "kiosk" everywhere in copy and code).

## Invariants

- **One human, one role-type, one workspace (v1).** A person is either a WorkOS user (manager+) or a PIN user (cashier), never both. A person belongs to at most one workspace. Multi-tenant for non-cashiers is explicitly deferred to a later version.
