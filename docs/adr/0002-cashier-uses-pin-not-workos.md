# Cashier auth uses a local PIN, not WorkOS

Cashiers do not have WorkOS accounts. They authenticate with a 4-6 digit PIN stored as a bcrypt hash in `User.pinHash`. The admin who creates the cashier communicates the PIN out-of-band. This keeps the cashier flow independent of WorkOS, avoids the cost and complexity of WorkOS Password auth, and matches the physical reality that a cashier works at one fixed point of sale.

## Status

accepted

## Considered Options

- **WorkOS `authenticateWithPassword`** — would force every cashier to have a WorkOS account, contradicting the "cashier es local" model.
- **Tauri-native PIN** — deferred. The `pinHash` field in the schema is forward-looking for a future desktop app; today the web app is the only client.

## Consequences

- We carry the cost of running a parallel auth path (PIN lookup, bcrypt verify, separate cookie).
- The `pinHash` field that has been dormant in the schema since v0 finally has a writer.
- The WorkOS-WorkOS-WorkOS assumption (every `userId` in a session resolves to `users.workosUserId`) is broken: cashier `userId` is the internal `users.id`. All user lookups in services must switch from `findUnique({ workosUserId })` to `findFirst({ where: { OR: [{ workosUserId }, { id }] } })`.
