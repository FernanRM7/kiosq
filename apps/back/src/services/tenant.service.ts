import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

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
      throw new BadRequestException(
        "No hay planes disponibles. Contacta al administrador."
      );
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name,
        planId: plan.id,
        settings: { createdByWorkosUserId: userId },
        slug,
      },
    });

    const userName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

    const existingUser = await this.prisma.user.findUnique({
      where: { workosUserId: userId },
    });

    const dbUser = await (existingUser
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

    try {
      await this.prisma.userTenant.upsert({
        create: { role: "ADMIN", tenantId: tenant.id, userId: dbUser.id },
        update: {},
        where: {
          userId_tenantId: { tenantId: tenant.id, userId: dbUser.id },
        },
      });
    } catch {
      this.logger.error(
        { dbUserId: dbUser.id, tenantId: tenant.id, userId },
        "user_tenants table may not exist — run prisma migrate deploy"
      );
    }

    this.logger.log(`Tenant created: ${tenant.id} for user ${userId}`);
    return tenant;
  }

  getTenantByUserId(userId: string) {
    return this.prisma.user.findUnique({
      include: { tenant: true },
      where: { workosUserId: userId },
    });
  }

  async listUserTenants(userId: string) {
    const user = await this.prisma.user.findUnique({
      include: {
        tenant: { select: { id: true, name: true, slug: true, status: true } },
      },
      where: { workosUserId: userId },
    });

    if (!user) {
      return [];
    }

    try {
      const userTenants = await this.prisma.userTenant.findMany({
        include: { tenant: true },
        orderBy: { joinedAt: "asc" },
        where: { userId: user.id },
      });

      return userTenants.map((ut) => ({
        id: ut.tenant.id,
        joinedAt: ut.joinedAt.toISOString(),
        name: ut.tenant.name,
        role: ut.role,
        slug: ut.tenant.slug,
        status: ut.tenant.status,
      }));
    } catch {
      // Fallback: query tenants by creator (stored in settings JSON) for when
      // the user_tenants migration hasn't been applied yet.
      const rows = await this.prisma.$queryRaw<
        {
          id: string;
          name: string;
          slug: string;
          status: string;
          createdAt: Date;
        }[]
      >`
        SELECT id, name, slug, status::text, "createdAt"
        FROM tenants
        WHERE settings->>'createdByWorkosUserId' = ${userId}
        ORDER BY "createdAt" ASC
      `;

      const seen = new Set<string>();
      const result: {
        id: string;
        joinedAt: string;
        name: string;
        role: string;
        slug: string;
        status: string;
      }[] = [];

      for (const row of rows) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          result.push({
            id: row.id,
            joinedAt: new Date(row.createdAt).toISOString(),
            name: row.name,
            role: user.role,
            slug: row.slug,
            status: row.status,
          });
        }
      }

      if (user.tenant && !seen.has(user.tenant.id)) {
        result.push({
          id: user.tenant.id,
          joinedAt: user.createdAt.toISOString(),
          name: user.tenant.name,
          role: user.role,
          slug: user.tenant.slug,
          status: user.tenant.status,
        });
      }

      return result;
    }
  }

  async switchTenant(
    userId: string,
    tenantId: string
  ): Promise<{ id: string; name: string; slug: string }> {
    const user = await this.prisma.user.findUnique({
      select: { id: true },
      where: { workosUserId: userId },
    });

    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    try {
      const membership = await this.prisma.userTenant.findUnique({
        include: { tenant: { select: { id: true, name: true, slug: true } } },
        where: {
          userId_tenantId: { tenantId, userId: user.id },
        },
      });

      if (!membership) {
        throw new ForbiddenException("No perteneces a este workspace");
      }
    } catch (error) {
      if (
        !(error instanceof ForbiddenException) &&
        !(error instanceof NotFoundException)
      ) {
        this.logger.error(
          { tenantId, userDbId: user.id, userId },
          "user_tenants lookup failed — attempting fallback"
        );
        // Table may not exist — verify tenant exists
        const tenant = await this.prisma.tenant.findUnique({
          select: { id: true, name: true, slug: true },
          where: { id: tenantId },
        });

        if (!tenant) {
          throw new NotFoundException("El workspace no existe");
        }

        // Verify ownership via creator in settings JSON
        const rows = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM tenants
          WHERE id = ${tenantId}
            AND settings->>'createdByWorkosUserId' = ${userId}
        `;

        if (rows.length === 0) {
          throw new ForbiddenException("No perteneces a este workspace");
        }

        await this.prisma.user.update({
          data: { tenantId },
          where: { id: user.id },
        });

        this.logger.log(
          `User ${userId} switched to tenant ${tenantId} (fallback)`
        );

        return {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        };
      }

      throw error;
    }

    const tenant = await this.prisma.tenant.findUnique({
      select: { id: true, name: true, slug: true },
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException("El workspace no existe");
    }

    await this.prisma.user.update({
      data: { tenantId },
      where: { id: user.id },
    });

    this.logger.log(`User ${userId} switched to tenant ${tenantId}`);

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    };
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private toSlug(name: string): string {
    const cleaned = name
      .toLowerCase()
      .normalize("NFD")
      .replaceAll(/[\u0300-\u036F]/gu, "")
      .replaceAll(/[^a-z0-9]+/gu, "-")
      .replaceAll(/^-+|-+$/gu, "");

    if (!cleaned) {
      return `tenant-${crypto.randomUUID().slice(0, 8)}`;
    }

    return cleaned;
  }

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
