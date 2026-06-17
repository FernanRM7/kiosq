import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../lib/prisma.service";

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createTenant(userId: string, name: string) {
    const slug = name
      .toLowerCase()
      .replaceAll(/\s+/gu, "-")
      .replaceAll(/[^a-z0-9-]/gu, "");

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
            name: "User",
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
}
