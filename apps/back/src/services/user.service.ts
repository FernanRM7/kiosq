import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../lib/prisma.service";
import type { MeResponseSchema } from "../schemas/me-response.schema";
import type { AuthenticatedSessionResult } from "../types/session.type";

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Builds the GET /me response.
   *
   * The role comes from the database (`users.role`), **not** from the
   * WorkOS session JWT claim. This ensures the frontend's UI gating
   * (sidebar items, settings, team section) and the backend's service-layer
   * authorization use the same source of truth.
   *
   * Falls back to `session.role` if the DB lookup fails (e.g. a WorkOS-only
   * user not yet synced to `users`).
   */
  async buildMeResponse(
    session: AuthenticatedSessionResult,
  ): Promise<MeResponseSchema> {
    const dbRole = await this.lookupDbRole(session.userId);

    return {
      email: session.user.email,
      emailVerified: session.user.emailVerified,
      firstName: session.user.firstName,
      id: session.userId,
      lastName: session.user.lastName,
      organizationId: session.organizationId,
      role: dbRole ?? session.role,
    };
  }

  private async lookupDbRole(
    userId: string,
  ): Promise<string | undefined> {
    try {
      const user = await this.prisma.user.findFirst({
        select: { role: true },
        where: { OR: [{ workosUserId: userId }, { id: userId }] },
      });
      return user?.role ?? undefined;
    } catch (error) {
      this.logger.warn(`Failed to look up DB role for ${userId}: ${error}`);
      return undefined;
    }
  }
}
