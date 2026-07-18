# Soft-delete members via `UserTenant.status = DISABLED`

Removing a member from a workspace sets `UserTenant.status = DISABLED`, never deletes the `User` row and never deletes the `UserTenant` row. The `User.isActive` flag is reserved as a global kill switch and is not used for membership state. Sales, stock movements, and audit records all reference `User` rows by id and must survive the user leaving the workspace.

## Status

accepted

## Consequences

- A deactivated member cannot log in to the workspace, but their historical `Sale.soldByUserId` and `StockMovement.userId` references remain valid.
- The same human can be re-added to the same workspace later by setting `UserTenant.status` back to ACTIVE (admin action, no re-invite).
- A `DISABLED` membership does not block creating a new membership for the same `User` in a different workspace, but that path is out of scope for v1 (one human = one workspace).
- The team list must filter out DISABLED rows by default but allow admins to see them via a toggle.
