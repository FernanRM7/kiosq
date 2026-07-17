# Cashier session lives in a separate cookie, not `wos-session`

The cashier session is stored in a second cookie, `cashier-session`, that is opaque to the existing WorkOS machinery. `AuthGuard` reads whichever cookie is present and dispatches to either `SessionService.authenticateSession` (WorkOS) or `CashierSessionService.authenticateCashierSession` (PIN). The cashier cookie value is a random session id; the actual session state (userId, tenantId) lives in Redis under `cashier_session:{sessionId}`. No encryption, no JWT, no WorkOS dependency at the cookie layer.

## Status

accepted

## Considered Options

- **Reuse `wos-session` and forge an iron-webcrypto envelope locally.** Rejected: the WorkOS SDK inlines `iron-webcrypto@2.0.0` and does not export `sealData`/`unsealData`. We would have to ship our own copy of the library and re-implement the envelope format, with no public spec to follow. Version drift with the SDK is a real risk.
- **Prefix in a single cookie (e.g. `workos:…` / `cashier:…`).** Rejected as a stylistic choice: a second cookie is the more obvious separation and matches the "two auth paths" mental model. Same number of code paths, simpler cookie-reading code.

## Consequences

- `AuthGuard` becomes a dispatcher. Two short branches, no shared logic.
- `SessionService` is unchanged. A new `CashierSessionService` owns the cashier path.
- `cookie.constants.ts` grows a new constant for the cashier cookie name and options.
- The cashier session has no JWT, no proactive refresh, and no expiration (Redis key is persistent, see ADR-0007 implicit). The cashier is locked out only when (a) an admin deletes their session via the team management UI, or (b) Redis is reset.
