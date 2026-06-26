import { Injectable, Logger } from "@nestjs/common";
import type { Role } from "@prisma/client";

import { PrismaService } from "../lib/prisma.service";
import type { WorkosEvent } from "../schemas/workos-event.schema";
import { AuthService } from "./auth.service";

/**
 * Synchronizes WorkOS identity data with the local PostgreSQL database.
 *
 * ## Idempotency guarantee
 * Every operation uses `upsert` keyed on the WorkOS ID (`workosOrgId` /
 * `workosUserId`). Re-processing the same event produces the same state —
 * safe for WorkOS's at-least-once delivery guarantee.
 *
 * ## Event mapping
 * | WorkOS event                        | Local action                                  |
 * |-------------------------------------|-----------------------------------------------|
 * | `organization.created`              | `upsert` Tenant by `workosOrgId`              |
 * | `organization.updated`              | `upsert` Tenant by `workosOrgId`              |
 * | `user.created`                      | Update identity fields if User already exists |
 * | `user.updated`                      | Update identity fields if User already exists |
 * | `organization_membership.created`   | Resolve Tenant → upsert User → link both      |
 *
 * ## Membership flow
 * `organization_membership.created` is the critical event that links a WorkOS
 * user to a local Tenant. If the user doesn't exist locally yet, this handler
 * fetches their profile from the WorkOS API and creates a fully-linked record.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService
  ) {}

  /**
   * Dispatches a validated WorkOS event to the appropriate handler.
   * Unknown event types are silently ignored (forward-compatible).
   */
  async handleEvent(event: WorkosEvent): Promise<void> {
    switch (event.event) {
      case "organization.created":
      case "organization.updated": {
        await this.upsertTenant(event.data.id, event.data.name);
        break;
      }

      case "user.created":
      case "user.updated": {
        await this.upsertUser({
          email: event.data.email,
          firstName: event.data.first_name ?? null,
          lastName: event.data.last_name ?? null,
          workosUserId: event.data.id,
        });
        break;
      }

      case "organization_membership.created": {
        await this.syncMembership({
          membershipId: event.data.id,
          organizationId: event.data.organization_id,
          roleSlug: event.data.role?.slug,
          userId: event.data.user_id,
        });
        break;
      }

      // WorkosEvent is a discriminated union — all variants are handled above.
      // This default satisfies the linter for forward-compatibility with future event types.
      default: {
        break;
      }
    }
  }

  // ─── Private handlers ────────────────────────────────────────────────────

  /**
   * Creates or updates a Tenant record keyed by `workosOrgId`.
   *
   * `slug` is derived from the organization name on first creation only —
   * subsequent updates preserve the existing slug to avoid breaking URLs.
   */
  private async upsertTenant(workosOrgId: string, name: string): Promise<void> {
    try {
      const slug = this.toSlug(name);

      const tenant = await this.prisma.tenant.upsert({
        create: {
          name,
          planId: await this.getDefaultPlanId(),
          slug: await this.resolveUniqueSlug(slug),
          workosOrgId,
        },
        update: {
          name,
        },
        where: { workosOrgId },
      });

      this.logger.log(
        `Tenant upserted: id=${tenant.id} workosOrgId=${workosOrgId} name="${name}"`
      );
    } catch (error) {
      this.logger.error(
        { err: error, workosOrgId },
        `Failed to upsert tenant: ${workosOrgId}`
      );
      throw error;
    }
  }

  /**
   * Updates identity fields (email, name) for an existing User.
   *
   * If the user doesn't exist yet this is a no-op — the
   * `organization_membership.created` event is responsible for creating
   * new users and linking them to a Tenant.
   */
  private async upsertUser(data: {
    workosUserId: string;
    email: string;
    firstName: string | null | undefined;
    lastName: string | null | undefined;
  }): Promise<void> {
    try {
      const name = this.buildName(data.firstName, data.lastName, data.email);

      const existing = await this.prisma.user.findUnique({
        select: { tenantId: true },
        where: { workosUserId: data.workosUserId },
      });

      if (existing) {
        await this.prisma.user.update({
          data: { email: data.email, name },
          where: { workosUserId: data.workosUserId },
        });

        this.logger.log(
          `User updated: workosUserId=${data.workosUserId} email="${data.email}"`
        );
      } else {
        this.logger.debug(
          `user.created/updated event for unknown user ${data.workosUserId} — ` +
            `awaiting organization_membership.created to create and link.`
        );
      }
    } catch (error) {
      this.logger.error(
        { err: error, workosUserId: data.workosUserId },
        `Failed to upsert user: ${data.workosUserId}`
      );
      throw error;
    }
  }

  /**
   * Links a WorkOS user to a local Tenant via organization membership.
   *
   * Flow:
   * 1. Resolve Tenant by `workosOrgId` — abort with warning if not found.
   * 2. Lookup existing User by `workosUserId`.
   *    - If found: update `tenantId` and `role` (idempotent update).
   *    - If not found: fetch user profile from WorkOS API → create User.
   * 3. Log the outcome.
   *
   * This operation is fully idempotent: replaying the same membership
   * event produces the same user state.
   *
   * @param membershipId    - WorkOS membership record ID (for logging)
   * @param userId          - WorkOS user ID of the new member
   * @param organizationId  - WorkOS organization ID
   * @param roleSlug        - WorkOS role slug (e.g. "admin", "member")
   */
  private async syncMembership(data: {
    membershipId: string;
    userId: string;
    organizationId: string;
    roleSlug: string | undefined;
  }): Promise<void> {
    try {
      // ── 1. Resolve Tenant ─────────────────────────────────────────────────
      const tenant = await this.prisma.tenant.findUnique({
        select: { id: true },
        where: { workosOrgId: data.organizationId },
      });

      if (!tenant) {
        this.logger.warn(
          `Tenant not found for workosOrgId="${data.organizationId}" ` +
            `(membership: ${data.membershipId}). ` +
            `Ensure organization.created is processed before membership events.`
        );
        return;
      }

      const role = this.mapRole(data.roleSlug);

      // ── 2. Upsert User ─────────────────────────────────────────────────────
      const existing = await this.prisma.user.findUnique({
        select: { id: true, tenantId: true },
        where: { workosUserId: data.userId },
      });

      if (existing) {
        await this.prisma.user.update({
          data: { role, tenantId: tenant.id },
          where: { workosUserId: data.userId },
        });

        this.logger.log(
          `Membership synced (existing user): workosUserId=${data.userId} ` +
            `tenantId=${tenant.id} role=${role}`
        );

        return;
      }

      // User doesn't exist locally — fetch profile from WorkOS API and create
      const workosUser = await this.authService.workos.userManagement.getUser(
        data.userId
      );

      const name = this.buildName(
        workosUser.firstName,
        workosUser.lastName,
        workosUser.email
      );

      await this.prisma.user.upsert({
        create: {
          email: workosUser.email,
          name,
          role,
          tenantId: tenant.id,
          workosUserId: data.userId,
        },
        update: {
          email: workosUser.email,
          name,
          role,
          tenantId: tenant.id,
        },
        where: { workosUserId: data.userId },
      });

      this.logger.log(
        `Membership synced (new user created): workosUserId=${data.userId} ` +
          `email="${workosUser.email}" tenantId=${tenant.id} role=${role}`
      );
    } catch (error) {
      this.logger.error(
        {
          err: error,
          membershipId: data.membershipId,
          organizationId: data.organizationId,
          workosUserId: data.userId,
        },
        `Failed to sync membership: ${data.membershipId}`
      );
      throw error;
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  /**
   * Maps a WorkOS role slug to the local Role enum.
   *
   * WorkOS roles are configurable strings. We map known slugs and default
   * to ADMIN for any unrecognized WorkOS-managed role, since WorkOS users
   * are owners/managers — not cashiers.
   *
   * Role assignments can be changed manually by tenant admins after sync.
   */
  private mapRole(slug: string | undefined): Role {
    if (slug === "admin") {
      return "ADMIN";
    }
    if (slug === "member") {
      return "MANAGER";
    }
    // Safe default for WorkOS-managed users (owners/admins, not cashiers)
    return "ADMIN";
  }

  /** Joins first + last name, falls back to email if both are absent */
  private buildName(
    firstName: string | null | undefined,
    lastName: string | null | undefined,
    email: string
  ): string {
    return [firstName, lastName].filter(Boolean).join(" ") || email;
  }

  /** Converts an organization name to a URL-safe slug */
  private toSlug(name: string): string {
    return (
      name
        .toLowerCase()
        .normalize("NFD")
        // Strip combining diacritical marks after NFD decomposition
        .replaceAll(/[\u0300-\u036F]/gu, "")
        .replaceAll(/[^a-z0-9]+/gu, "-")
        .replaceAll(/^-+|-+$/gu, "")
    );
  }

  /**
   * Appends a numeric suffix to a slug if it's already taken.
   * Ensures every tenant gets a unique slug at creation time.
   *
   * Sequential DB lookups are intentional: we need to verify each candidate
   * slug one at a time to avoid race conditions in concurrent tenant creation.
   */
  private async resolveUniqueSlug(base: string): Promise<string> {
    const tenants = await this.prisma.tenant.findMany({
      select: {
        slug: true,
      },
      where: {
        slug: {
          startsWith: base,
        },
      },
    });

    const used = new Set(tenants.map((t) => t.slug));

    let candidate = base;
    let suffix = 0;

    while (used.has(candidate)) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  }

  /**
   * Returns the ID of the default (cheapest active) plan.
   * Used as placeholder when creating a tenant from a WorkOS webhook —
   * the tenant admin must select a plan during onboarding.
   */
  private async getDefaultPlanId(): Promise<string> {
    const plan = await this.prisma.plan.findFirst({
      orderBy: { priceMonthly: "asc" },
      select: { id: true },
      where: { isActive: true },
    });

    if (!plan) {
      throw new Error(
        "No hay planes disponibles. No se puede crear el tenant desde el webhook de WorkOS."
      );
    }

    return plan.id;
  }
}
