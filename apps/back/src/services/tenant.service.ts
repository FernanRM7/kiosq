import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../lib/prisma.service";

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createTenant(
    userId: string,
    name: string,
    user: {
      firstName?: string | null;
      lastName?: string | null;
      email: string;
    }
  ) {
    const slug = await this.resolveUniqueSlug(this.toSlug(name));

    const plan = await this.prisma.plan.findFirst({
      orderBy: { priceMonthly: "asc" },
      where: { isActive: true },
    });

    if (!plan) {
      throw new Error("No active plan found. Seed at least one plan.");
    }

    const tenant = await this.prisma.tenant.create({
      data: { name, planId: plan.id, slug },
    });

    const userName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

    const existingUser = await this.prisma.user.findUnique({
      where: { workosUserId: userId },
    });

    await (existingUser
      ? this.prisma.user.update({
          data: { role: "ADMIN", tenantId: tenant.id },
          where: { workosUserId: userId },
        })
      : this.prisma.user.create({
          data: {
            email: user.email,
            name: userName,
            role: "ADMIN",
            tenantId: tenant.id,
            workosUserId: userId,
          },
        }));

    this.logger.log(`Tenant created: ${tenant.id} for user ${userId}`);
    return tenant;
  }

  getTenantByUserId(userId: string) {
    return this.prisma.user.findUnique({
      include: { tenant: true },
      where: { workosUserId: userId },
    });
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  /**
   * Converts a name to a URL-safe slug using the same robust pipeline as
   * SyncService: NFD normalization, diacritic stripping, non-alphanumeric
   * replacement, and leading/trailing hyphen trimming.
   *
   * If the result is empty (e.g. input was entirely emojis or symbols),
   * a random UUID-based fallback is returned to avoid empty-slug DB errors.
   */
  private toSlug(name: string): string {
    const cleaned = name
      .toLowerCase()
      .normalize("NFD")
      // Strip combining diacritical marks after NFD decomposition
      .replaceAll(/[\u0300-\u036F]/gu, "")
      .replaceAll(/[^a-z0-9]+/gu, "-")
      .replaceAll(/^-+|-+$/gu, "");

    if (!cleaned) {
      // Fallback for names composed entirely of non-Latin characters
      return `tenant-${crypto.randomUUID().slice(0, 8)}`;
    }

    return cleaned;
  }

  /**
   * Appends a numeric suffix to a slug if it is already taken, ensuring
   * every tenant gets a unique slug at creation time.
   */
  private async resolveUniqueSlug(base: string): Promise<string> {
    const existing = await this.prisma.tenant.findMany({
      select: { slug: true },
      where: { slug: { startsWith: base } },
    });

    const used = new Set(existing.map((t) => t.slug));

    let candidate = base;
    let suffix = 0;

    while (used.has(candidate)) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  }
}
