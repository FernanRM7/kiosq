import { Injectable } from "@nestjs/common";

import type { MeResponseSchema } from "../schemas/me-response.schema";
import type { AuthenticatedSessionResult } from "../types/session.type";

@Injectable()
export class UserService {
  /**
   * Builds the GET /me response from the authenticated session.
   * Maps WorkOS user fields to the public response schema.
   */
  buildMeResponse(session: AuthenticatedSessionResult): MeResponseSchema {
    return {
      email: session.user.email,
      emailVerified: session.user.emailVerified,
      firstName: session.user.firstName,
      id: session.userId,
      lastName: session.user.lastName,
      organizationId: session.organizationId,
      role: session.role,
    };
  }
}
