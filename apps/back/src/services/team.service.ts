import {
  ConflictException,
  Injectable,
  ForbiddenException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";

import { PrismaService } from "../lib/prisma.service";
import { CashierSessionService } from "./cashier-session.service";

const SALT_ROUNDS = 10;

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cashierSessionService: CashierSessionService,
  ) {}

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

  /**
   * Lists all members of the caller's workspace.
   * Cashiers, managers, and admins are included.
   */
  async listMembers(
    callerId: string,
  ): Promise<
    {
      id: string;
      name: string;
      email: string | null;
      role: string;
      status: string;
    }[]
  > {
    const caller = await this.prisma.user.findFirst({
      select: { tenantId: true },
      where: { OR: [{ workosUserId: callerId }, { id: callerId }] },
    });

    if (!caller) {
      return [];
    }

    const members = await this.prisma.userTenant.findMany({
      select: {
        role: true,
        status: true,
        user: {
          select: { id: true, email: true, name: true },
        },
      },
      where: { tenantId: caller.tenantId },
      orderBy: { joinedAt: "asc" },
    });

    return members.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      status: m.status,
    }));
  }

  /**
   * Creates a manager member in the caller's workspace.
   *
   * - Pre-creates a User (workosUserId = null) so the person can later
   *   sign in via WorkOS and get linked by the webhook fallback.
   * - The membership starts as PENDING.
   * - No email is sent — the admin tells the new manager out-of-band.
   *
   * Throws 409 if the email already has an active membership in any workspace.
   */
  async createManager(
    callerId: string,
    data: {
      email: string;
    },
  ): Promise<{
    id: string;
    email: string | null;
    role: string;
    status: string;
  }> {
    const normalizedEmail = data.email.toLowerCase().trim();

    // V1 invariant: block if the email already belongs to another workspace
    const existing = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, isActive: true },
    });

    if (existing && existing.tenantId) {
      throw new ConflictException(
        "Este email ya pertenece a otro workspace",
      );
    }

    const caller = await this.prisma.user.findFirst({
      select: { id: true, tenantId: true },
      where: { OR: [{ workosUserId: callerId }, { id: callerId }] },
    });

    if (!caller) {
      throw new ForbiddenException("Usuario no encontrado en el sistema");
    }

    const { tenantId } = caller;

    // Check if the email already exists in this tenant
    const existingInTenant = await this.prisma.user.findUnique({
      where: { tenantId_email: { email: normalizedEmail, tenantId } },
    });

    if (existingInTenant) {
      throw new ConflictException(
        "Este email ya es miembro de este workspace",
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name: normalizedEmail,
        role: "MANAGER",
        tenantId,
        isActive: true,
      },
      select: { id: true, email: true },
    });

    const membership = await this.prisma.userTenant.create({
      data: {
        userId: user.id,
        tenantId,
        role: "MANAGER",
        status: "PENDING",
        invitedByUserId: caller.id,
      },
      select: {
        role: true,
        status: true,
        user: { select: { id: true, email: true } },
      },
    });

    this.logger.log(
      `Manager pre-created: user=${user.id} email=${normalizedEmail} tenant=${tenantId}`,
    );

    return {
      id: membership.user.id,
      email: membership.user.email ?? null,
      role: membership.role,
      status: membership.status,
    };
  }

  /**
   * Transitions a membership to DISABLED. The member cannot log in,
   * but their historical data is preserved.
   */
  async disableMember(userId: string): Promise<void> {
    await this.prisma.userTenant.updateMany({
      data: { status: "DISABLED" },
      where: { userId },
    });

    this.logger.log(`Member disabled: userId=${userId}`);
  }

  /**
   * Reactivates a previously disabled membership.
   */
  async enableMember(userId: string): Promise<void> {
    await this.prisma.userTenant.updateMany({
      data: { status: "ACTIVE" },
      where: { userId },
    });

    this.logger.log(`Member enabled: userId=${userId}`);
  }

  /**
   * Cancels a pending manager invite (transitions to DISABLED).
   * Only valid for PENDING memberships.
   */
  async cancelInvite(userId: string): Promise<void> {
    const updated = await this.prisma.userTenant.updateMany({
      data: { status: "DISABLED" },
      where: { userId, status: "PENDING" },
    });

    if (updated.count === 0) {
      throw new NotFoundException(
        "La invitación no está pendiente o no existe",
      );
    }

    this.logger.log(`Invite cancelled: userId=${userId}`);
  }

  /**
   * Ends all active cashier sessions for the given user.
   */
  async revokeCashierSession(userId: string): Promise<void> {
    await this.cashierSessionService.revokeCashierSession(userId);
    this.logger.log(`Cashier session revoked: userId=${userId}`);
  }
}
