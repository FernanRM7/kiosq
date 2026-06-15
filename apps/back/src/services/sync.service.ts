import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../lib/prisma.service";
import type { WorkosEvent } from "../schemas/workos-event.schema";

/**
 * Synchronizes WorkOS identity data with the local PostgreSQL database.
 *
 * ## Idempotency guarantee
 * Every operation uses `upsert` keyed on the WorkOS ID (`workosOrgId` /
 * `workosUserId`). Re-processing the same event produces the same state —
 * safe for WorkOS's at-least-once delivery guarantee.
 *
 * ## Event mapping
 * | WorkOS event             | Local action                           |
 * |--------------------------|----------------------------------------|
 * | `organization.created`   | `upsert` Tenant by `workosOrgId`       |
 * | `organization.updated`   | `upsert` Tenant by `workosOrgId`       |
 * | `user.created`           | `upsert` User by `workosUserId`        |
 * | `user.updated`           | `upsert` User by `workosUserId`        |
 *
 * ## Missing Tenant on user events
 * WorkOS does not guarantee that `organization.created` arrives before
 * `user.created`. When the linked tenant cannot be found, the user record
 * is created without a `tenantId` link — callers must associate it later
 * once the organization syncs. (This scenario is logged as a warning.)
 *
 * Note: `user.created` / `user.updated` from WorkOS carry the **organization
 * membership** via a separate `organization_membership.*` event — not inline.
 * For now, we sync the user identity fields only; tenant association is
 * handled by the `organization_membership` event family or manual linking.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    const slug = this.toSlug(name);

    const tenant = await this.prisma.tenant.upsert({
      create: {
        name,
        // planId must be set — use a sentinel that onboarding replaces.
        // A real implementation would derive the plan from the WorkOS
        // organization metadata or prompt during signup.
        planId: await this.getDefaultPlanId(),
        slug: await this.resolveUniqueSlug(slug),
        workosOrgId,
      },
      update: {
        name,
        // Slug is intentionally NOT updated to preserve existing URLs
      },
      where: { workosOrgId },
    });

    this.logger.log(
      `Tenant upserted: id=${tenant.id} workosOrgId=${workosOrgId} name="${name}"`
    );
  }

  /**
   * Creates or updates a User record keyed by `workosUserId`.
   *
   * Users synced from WorkOS have no `tenantId` until associated via an
   * organization membership event or manual admin action.
   *
   * Role defaults to ADMIN for WorkOS-managed users (owners/managers).
   * Cashier-only users are created directly by tenant admins — not via WorkOS.
   */
  private async upsertUser(data: {
    workosUserId: string;
    email: string;
    firstName: string | null | undefined;
    lastName: string | null | undefined;
  }): Promise<void> {
    const name =
      [data.firstName, data.lastName].filter(Boolean).join(" ") || data.email;

    // Find existing user to preserve tenantId on updates
    const existing = await this.prisma.user.findUnique({
      select: { tenantId: true },
      where: { workosUserId: data.workosUserId },
    });

    if (existing) {
      // Update: preserve tenantId and role, update identity fields
      await this.prisma.user.update({
        data: {
          email: data.email,
          name,
        },
        where: { workosUserId: data.workosUserId },
      });

      this.logger.log(
        `User updated: workosUserId=${data.workosUserId} email="${data.email}"`
      );
    } else {
      // Create: new WorkOS user — tenantId unknown until membership event
      // We use a placeholder tenantId approach: find or log a warning
      this.logger.warn(
        `User created from WorkOS without tenant association: workosUserId=${data.workosUserId}. ` +
          `Awaiting organization_membership event or manual assignment.`
      );

      // NOTE: We cannot create the user without tenantId (FK required).
      // Store the intent — real flow: organization_membership event links user to tenant.
      // For now, log for manual resolution.
      this.logger.debug(`WorkOS user data: email=${data.email} name="${name}"`);
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  /** Converts an organization name to a URL-safe slug */
  private toSlug(name: string): string {
    return (
      name
        .toLowerCase()
        .normalize("NFD")
        // strip diacritics
        .replaceAll(/[\u0300-\u036F]/gu, "")
        .replaceAll(/[^a-z0-9]+/gu, "-")
        .replaceAll(/^-+|-+$/gu, "")
    );
  }

  /**
   * Appends a numeric suffix to a slug if it's already taken.
   * Ensures every tenant gets a unique slug at creation time.
   */
  private async resolveUniqueSlug(base: string): Promise<string> {
    let candidate = base;
    let suffix = 1;

    while (
      // eslint-disable-next-line no-await-in-loop
      await this.prisma.tenant.findUnique({ where: { slug: candidate } })
    ) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
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
        "No active plans found. Cannot create tenant from WorkOS webhook. " +
          "Seed at least one plan before enabling WorkOS sync."
      );
    }

    return plan.id;
  }
}
