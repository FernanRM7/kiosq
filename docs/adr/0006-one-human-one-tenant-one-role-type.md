# One human, one role-type, one workspace (v1)

In v1, a person is exactly one of: a WorkOS-authenticated manager/admin, or a PIN-authenticated cashier. They live in exactly one workspace. The two paths do not overlap: a WorkOS user cannot have a `pinHash`, and a cashier cannot have a `workosUserId`. Multi-tenant membership for non-cashiers is explicitly deferred.

## Status

accepted

## Consequences

- The `User.workosUserId` and `User.pinHash` fields are mutually exclusive in practice, even though the schema leaves both nullable. Enforced at the service layer when creating each kind of user.
- Creating a manager and a cashier for the same email in the same workspace is an error (409 Conflict) — the second create fails on the `@@unique([tenantId, email])` constraint and the service surfaces a clear message.
- Inviting the same email to a second workspace is blocked at the service layer: if any `UserTenant` row for that email is ACTIVE in any workspace, the create fails.
- The frontend does not need to handle "switch workspace" for cashiers; the existing `canSwitchWorkspace` check already excludes them, and now the backend enforces the same invariant structurally.
- When we relax this invariant in v2, the changes are well-bounded: relax the unique constraint on `UserTenant`, add a per-row active-workspace pointer, allow `workosUserId` and `pinHash` to coexist. No new auth path is needed.
