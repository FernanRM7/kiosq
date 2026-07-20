import { pbkdf2Sync, randomBytes, randomInt } from "node:crypto";

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../lib/prisma.service";
import type {
  CreateCashierInput,
  UpdateTenantSettingsInput,
} from "../schemas/tenant-dashboard.schema";

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
        settings: {
          cashOpeningAmount: 500,
          createdByWorkosUserId: userId,
        },
        slug,
      },
    });

    const userName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ workosUserId: userId }, { id: userId }] },
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

  async updateTenantSettings(userId: string, input: UpdateTenantSettingsInput) {
    const currentUser = await this.prisma.user.findUnique({
      select: { id: true, tenantId: true },
      where: { workosUserId: userId },
    });

    if (!currentUser) {
      throw new NotFoundException("Usuario no encontrado");
    }

    const tenant = await this.prisma.tenant.findUnique({
      select: { id: true, settings: true },
      where: { id: currentUser.tenantId },
    });

    if (!tenant) {
      throw new NotFoundException("Negocio no encontrado");
    }

    const settings = this.normalizeTenantSettings(tenant.settings);

    await this.prisma.tenant.update({
      data: {
        settings: {
          ...settings,
          cashOpeningAmount: input.cashOpeningAmount,
        },
      },
      where: { id: tenant.id },
    });

    this.logger.log(`Tenant settings updated: ${tenant.id} for user ${userId}`);
    return this.getTenantByUserId(userId);
  }

  async createCashier(userId: string, input: CreateCashierInput) {
    const currentUser = await this.prisma.user.findUnique({
      select: { id: true, tenantId: true },
      where: { workosUserId: userId },
    });

    if (!currentUser) {
      throw new NotFoundException("Usuario no encontrado");
    }

    const tenant = await this.prisma.tenant.findUnique({
      select: {
        id: true,
        plan: {
          select: { maxUsers: true },
        },
      },
      where: { id: currentUser.tenantId },
    });

    if (!tenant) {
      throw new NotFoundException("Negocio no encontrado");
    }

    const cashierLimit = this.getCashierLimit(tenant.plan?.maxUsers);
    const cashierCount = await this.prisma.user.count({
      where: {
        role: "CASHIER",
        tenantId: tenant.id,
      },
    });

    if (cashierCount >= cashierLimit) {
      throw new BadRequestException(
        "Tu plan ya no tiene espacios disponibles para cajeros"
      );
    }

    const credentials = this.generateCashierCredentials();

    const cashier = await this.prisma.user.create({
      data: {
        email: null,
        isActive: true,
        name: input.name.trim(),
        pinHash: credentials.pinHash,
        role: "CASHIER",
        tenantId: tenant.id,
        workosUserId: null,
      },
      select: { id: true },
    });

    try {
      await this.prisma.userTenant.upsert({
        create: {
          role: "CASHIER",
          tenantId: tenant.id,
          userId: cashier.id,
        },
        update: {
          role: "CASHIER",
        },
        where: {
          userId_tenantId: { tenantId: tenant.id, userId: cashier.id },
        },
      });
    } catch {
      this.logger.error(
        { cashierId: cashier.id, tenantId: tenant.id, userId },
        "user_tenants table may not exist — run prisma migrate deploy"
      );
    }

    this.logger.log(`Cashier created: ${cashier.id} for tenant ${tenant.id}`);
    return {
      temporaryPin: credentials.pin,
      tenant: await this.getTenantByUserId(userId),
    };
  }

  getTenantByUserId(userId: string) {
    return this.prisma.user.findFirst({
      select: {
        email: true,
        id: true,
        name: true,
        role: true,
        tenant: {
          select: {
            id: true,
            name: true,
            plan: {
              select: {
                id: true,
                maxBranches: true,
                maxDevices: true,
                maxUsers: true,
                name: true,
              },
            },
            planId: true,
            settings: true,
            slug: true,
            status: true,
            users: {
              orderBy: { createdAt: "asc" },
              select: {
                email: true,
                id: true,
                isActive: true,
                lastLoginAt: true,
                name: true,
                role: true,
              },
              where: { role: "CASHIER" },
            },
          },
        },
        tenantId: true,
        workosUserId: true,
      },
      where: { OR: [{ workosUserId: userId }, { id: userId }] },
    });
  }

  async listUserTenants(userId: string) {
    const user = await this.prisma.user.findFirst({
      include: {
        tenant: { select: { id: true, name: true, slug: true, status: true } },
      },
      where: { OR: [{ workosUserId: userId }, { id: userId }] },
    });

    if (!user) {
      return [];
    }

    if (user.role === "CASHIER") {
      throw new ForbiddenException("No tienes permisos para ver workspaces");
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
    const user = await this.prisma.user.findFirst({
      select: { id: true, role: true },
      where: { OR: [{ workosUserId: userId }, { id: userId }] },
    });

    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    if (user.role === "CASHIER") {
      throw new ForbiddenException(
        "No tienes permisos para cambiar de workspace"
      );
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

  // TODO: These methods were recovered from feat/modificaciones-a-todo-el-sas.
  // They need proper implementation aligned with the current service architecture.

  // eslint-disable-next-line @typescript-eslint/require-await
  async updateTenant(_userId: string, _body: unknown): Promise<unknown> {
    throw new BadRequestException("updateTenant not yet implemented");
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async updateCashier(
    _userId: string,
    _cashierId: string,
    _body: unknown
  ): Promise<unknown> {
    throw new BadRequestException("updateCashier not yet implemented");
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async deleteTenant(_userId: string, _body: unknown): Promise<unknown> {
    throw new BadRequestException("deleteTenant not yet implemented");
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private getCashierLimit(maxUsers: number | undefined | null): number {
    return Math.max((maxUsers ?? 3) - 1, 0);
  }

  private generateCashierCredentials(): {
    pin: string;
    pinHash: string;
  } {
    const pin = String(randomInt(100_000, 1_000_000));
    const salt = randomBytes(16).toString("hex");
    const hash = pbkdf2Sync(pin, salt, 100_000, 64, "sha256").toString("hex");

    return {
      pin,
      pinHash: `pbkdf2$100000$${salt}$${hash}`,
    };
  }

  private normalizeTenantSettings(settings: unknown): Record<string, unknown> {
    if (
      settings !== null &&
      typeof settings === "object" &&
      !Array.isArray(settings)
    ) {
      return { ...settings };
    }

    return {};
  }

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
