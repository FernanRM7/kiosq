import type { Prisma } from "@prisma/client";

/**
 * Finds a user by either their `workosUserId` (WorkOS-managed users) or
 * their internal `id` (cashier users, who have no WorkOS id).
 *
 * This is the single seam for user lookup so that every call site
 * (product, category, sale, tenant, and future services) resolves
 * both WorkOS and cashier users with the same query.
 *
 * @example
 * const user = await findUser(prisma, userId, { select: { role: true, tenantId: true } });
 * if (!user) { ... handle not found ... }
 */
export function buildUserLookup<T extends Prisma.UserFindFirstArgs>(
  userId: string,
  args: Omit<T, "where">
): T {
  return {
    ...args,
    where: {
      OR: [{ workosUserId: userId }, { id: userId }],
    } as Prisma.UserWhereInput,
  } as T;
}
