# No invitation module — admin creates users directly

There is no "invite" flow. The admin opens a "Crear manager" or "Crear cashier" form and the backend writes a `User` + `UserTenant` row immediately. For managers, the admin tells the new user (verbally, out-of-band) to self-register at the standard WorkOS AuthKit URL with the same email; the `organization_membership.created` webhook then fills in `workosUserId` and transitions `UserTenant.status` from PENDING to ACTIVE. We deliberately skip `workos.userManagement.sendUserInvite` and do not introduce a transactional mailer.

## Status

accepted

## Considered Options

- **`workos.userManagement.sendUserInvite` for managers.** Rejected: pulls in a new email dependency and a non-trivial error-handling surface (already-registered emails, cross-org conflicts) for marginal UX gain in a small-team product.
- **Custom mailer (Resend, etc.).** Rejected: same reasons plus the burden of templates, bounces, and provider lock-in. v1 keeps the admin in the loop.
- **Admin creates a WorkOS user via the WorkOS Admin API.** Rejected: same path as `sendUserInvite` minus the email; we still need to handle already-registered users and we lose the natural "self-register" UX.

## Consequences

- The `UserTenant.status` field has a real meaning: PENDING for managers who have not yet completed WorkOS registration, ACTIVE for everyone else.
- The team list must show a "pending" indicator so admins know who is waiting on WorkOS.
- Managers with stale PENDING records (never registered) are a permanent state unless the admin explicitly cancels them. We add a "Cancelar invitación" action that transitions to DISABLED.
- Email casing and alias differences between the admin-entered email and the WorkOS-registered email are now a real failure mode for the webhook-to-precreated-row reconciliation. We normalize emails to lowercase on write and on webhook lookup.
