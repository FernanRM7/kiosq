import { describe, expect, it, jest } from "@jest/globals";

import type { AuthenticatedSessionResult } from "../types/session.type";
import type { PrismaService } from "../lib/prisma.service";
import { UserService } from "./user.service";

// ─── Fixture ──────────────────────────────────────────────────────────────────

function makeSession(
  overrides: Partial<{
    userId: string;
    orgId: string | undefined;
    role: string | undefined;
    firstName: string | null;
    lastName: string | null;
    emailVerified: boolean;
  }> = {}
): AuthenticatedSessionResult {
  const has = (key: string) =>
    Object.prototype.hasOwnProperty.call(overrides, key);

  return {
    accessToken: "access.token",
    authenticated: true,
    organizationId: has("orgId") ? overrides.orgId : "org_01",
    role: has("role") ? overrides.role : "admin",
    sessionId: "session_01",
    user: {
      createdAt: "2024-01-01T00:00:00.000Z",
      email: "user@example.com",
      emailVerified: overrides.emailVerified ?? true,
      externalId: null,
      firstName: has("firstName") ? overrides.firstName! : "Jane",
      id: overrides.userId ?? "user_01",
      lastSignInAt: null,
      lastName: has("lastName") ? overrides.lastName! : "Doe",
      locale: null,
      metadata: {},
      name: "Jane Doe",
      object: "user",
      profilePictureUrl: null,
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
    userId: overrides.userId ?? "user_01",
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("UserService — buildMeResponse()", () => {
  const mockPrisma = {
    user: {
      findFirst: jest.fn<(...args: unknown[]) => Promise<{ role: string } | null>>().mockResolvedValue(null),
    },
  } as unknown as PrismaService;
  const service = new UserService(mockPrisma);

  // ── Field mapping ──────────────────────────────────────────────────────────

  it("maps userId from session to response id", async () => {
    const result = await service.buildMeResponse(makeSession({ userId: "user_99" }));
    expect(result.id).toBe("user_99");
  });

  it("maps user.email from session to response email", async () => {
    const result = await service.buildMeResponse(makeSession());
    expect(result.email).toBe("user@example.com");
  });

  it("maps user.firstName (string value)", async () => {
    const result = await service.buildMeResponse(makeSession({ firstName: "Ana" }));
    expect(result.firstName).toBe("Ana");
  });

  it("maps user.firstName as null when absent", async () => {
    const result = await service.buildMeResponse(makeSession({ firstName: null }));
    expect(result.firstName).toBeNull();
  });

  it("maps user.lastName (string value)", async () => {
    const result = await service.buildMeResponse(makeSession({ lastName: "García" }));
    expect(result.lastName).toBe("García");
  });

  it("maps user.lastName as null when absent", async () => {
    const result = await service.buildMeResponse(makeSession({ lastName: null }));
    expect(result.lastName).toBeNull();
  });

  it("maps user.emailVerified = true", async () => {
    const result = await service.buildMeResponse(
      makeSession({ emailVerified: true })
    );
    expect(result.emailVerified).toBe(true);
  });

  it("maps user.emailVerified = false", async () => {
    const result = await service.buildMeResponse(
      makeSession({ emailVerified: false })
    );
    expect(result.emailVerified).toBe(false);
  });

  // ── Organization claim ─────────────────────────────────────────────────────

  it("maps organizationId when user belongs to an org", async () => {
    const result = await service.buildMeResponse(makeSession({ orgId: "org_42" }));
    expect(result.organizationId).toBe("org_42");
  });

  it("maps organizationId as undefined when user has no org", async () => {
    const result = await service.buildMeResponse(makeSession({ orgId: undefined }));
    expect(result.organizationId).toBeUndefined();
  });

  // ── RBAC role claim ────────────────────────────────────────────────────────

  it("maps role when present", async () => {
    const result = await service.buildMeResponse(makeSession({ role: "owner" }));
    expect(result.role).toBe("owner");
  });

  it("maps role as undefined when not set", async () => {
    const result = await service.buildMeResponse(makeSession({ role: undefined }));
    expect(result.role).toBeUndefined();
  });

  // ── Complete response shape ────────────────────────────────────────────────

  it("returns a response with all seven defined fields", async () => {
    const result = await service.buildMeResponse(makeSession());

    expect(Object.keys(result)).toStrictEqual(
      expect.arrayContaining([
        "id",
        "email",
        "firstName",
        "lastName",
        "emailVerified",
        "organizationId",
        "role",
      ])
    );
  });
});
