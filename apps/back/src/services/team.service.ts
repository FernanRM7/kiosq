import { Injectable, ForbiddenException, Logger } from "@nestjs/common";
import * as bcrypt from "bcrypt";

import type { PrismaService } from "../lib/prisma.service";

const SALT_ROUNDS = 10;

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Throws ForbiddenException unless the caller is ADMIN or SUPER_ADMIN.
   * Manager-only users (and cashiers) cannot create or manage members.
   */
  assertCanManageTeam(role: string): void {
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      throw new ForbiddenException(
        "No tienes permisos para administrar el equipo",
      );
    }
  }

  /**
   * Creates a cashier member in the workspace of the caller.
   *
   * - PIN must be 4–6 numeric digits.
   * - PIN is stored as a bcrypt hash.
   * - The cashier is immediately ACTIVE (no WorkOS flow).
   *
   * Returns the created UserTenant with the associated User data.
   */
  async createCashier(
    callerId: string,
    data: {
      name: string;
      email?: string;
      pin: string;
    },
  ): Promise<{
    id: string;
    name: string;
    email: string | null;
    role: string;
    status: string;
  }> {
    const caller = await this.prisma.user.findFirst({
      select: { id: true, tenantId: true },
      where: { OR: [{ workosUserId: callerId }, { id: callerId }] },
    });

    if (!caller) {
      throw new ForbiddenException("Usuario no encontrado en el sistema");
    }

    const { tenantId } = caller;
    const normalizedEmail = data.email ? data.email.toLowerCase() : undefined;

    const pinHash = await bcrypt.hash(data.pin, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name: data.name,
        role: "CASHIER",
        pinHash,
        tenantId,
        isActive: true,
      },
      select: { id: true, email: true, name: true },
    });

    const membership = await this.prisma.userTenant.create({
      data: {
        userId: user.id,
        tenantId,
        role: "CASHIER",
        status: "ACTIVE",
        invitedByUserId: caller.id,
      },
      select: {
        role: true,
        status: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    this.logger.log(`Cashier created: user=${user.id} tenant=${tenantId}`);

    return {
      id: membership.user.id,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
      status: membership.status,
    };
  }
}
