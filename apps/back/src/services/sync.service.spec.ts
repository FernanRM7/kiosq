import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../lib/prisma.service";
import { AuthService } from "./auth.service";
import { SyncService } from "./sync.service";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

const MOCK_PLAN_ID = "plan_default_01";
const MOCK_TENANT_ID = "tenant_01";
const MOCK_USER_ID = "user_local_01";

/** WorkOS API user profile returned by getUser() */
const MOCK_WORKOS_USER = {
  email: "jane@example.com",
  emailVerified: true,
  firstName: "Jane",
  id: "wos_user_01",
  lastName: "Doe",
};

function makeMockPrisma() {
  return {
    plan: {
      findFirst: jest
        .fn<(...args: unknown[]) => Promise<{ id: string } | null>>()
        .mockResolvedValue({ id: MOCK_PLAN_ID }),
    },
    tenant: {
      findMany: jest
        .fn<(...args: unknown[]) => Promise<{ slug: string }[]>>()
        .mockResolvedValue([]),
      findUnique: jest
        .fn<(...args: unknown[]) => Promise<{ id: string } | null>>()
        .mockResolvedValue(null),
      upsert: jest
        .fn<(...args: unknown[]) => Promise<{ id: string; slug: string }>>()
        .mockResolvedValue({ id: MOCK_TENANT_ID, slug: "acme" }),
    },
    user: {
      findFirst: jest
        .fn<(...args: unknown[]) => Promise<{ id: string } | null>>()
        .mockResolvedValue(null),
      findUnique: jest
        .fn<
          (
            ...args: unknown[]
          ) => Promise<{ id: string; tenantId: string } | null>
        >()
        .mockResolvedValue(null),
      update: jest
        .fn<(...args: unknown[]) => Promise<{ id: string }>>()
        .mockResolvedValue({ id: MOCK_USER_ID }),
      upsert: jest
        .fn<(...args: unknown[]) => Promise<{ id: string }>>()
        .mockResolvedValue({ id: MOCK_USER_ID }),
    },
    userTenant: {
      updateMany: jest
        .fn<(...args: unknown[]) => Promise<{ count: number }>>()
        .mockResolvedValue({ count: 1 }),
    },
  };
}

function makeMockAuthService() {
  return {
    workos: {
      userManagement: {
        getUser: jest
          .fn<(...args: unknown[]) => Promise<typeof MOCK_WORKOS_USER>>()
          .mockResolvedValue(MOCK_WORKOS_USER),
      },
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SyncService", () => {
  let service: SyncService;
  let prismaMock: ReturnType<typeof makeMockPrisma>;
  let authServiceMock: ReturnType<typeof makeMockAuthService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock = makeMockPrisma();
    authServiceMock = makeMockAuthService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
  });

  // ── organization.created ──────────────────────────────────────────────────

  describe("organization.created", () => {
    const event = {
      event: "organization.created" as const,
      id: "evt_org_01",
      data: { id: "org_01", name: "Acme Corp" },
    };

    it("calls tenant.upsert with workosOrgId as the where clause", async () => {
      await service.handleEvent(event);

      expect(prismaMock.tenant.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workosOrgId: "org_01" } })
      );
    });

    it("creates tenant with correct name", async () => {
      await service.handleEvent(event);

      expect(prismaMock.tenant.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ name: "Acme Corp" }),
        })
      );
    });

    it("derives slug from organization name", async () => {
      await service.handleEvent(event);

      const call = jest.mocked(prismaMock.tenant.upsert).mock.calls[0][0] as {
        create: { slug: string };
      };
      expect(call.create.slug).toBe("acme-corp");
    });

    it("strips diacritics from slug", async () => {
      await service.handleEvent({
        ...event,
        data: { ...event.data, name: "Tiendá Ópticá" },
      });

      const call = jest.mocked(prismaMock.tenant.upsert).mock.calls[0][0] as {
        create: { slug: string };
      };
      expect(call.create.slug).toBe("tienda-optica");
    });

    it("is idempotent — upsert does NOT change slug on update", async () => {
      await service.handleEvent(event);

      const call = jest.mocked(prismaMock.tenant.upsert).mock.calls[0][0] as {
        update: Record<string, unknown>;
      };
      expect(call.update).not.toHaveProperty("slug");
    });

    it("uses the default plan ID from the cheapest active plan", async () => {
      await service.handleEvent(event);

      expect(prismaMock.plan.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } })
      );

      const call = jest.mocked(prismaMock.tenant.upsert).mock.calls[0][0] as {
        create: { planId: string };
      };
      expect(call.create.planId).toBe(MOCK_PLAN_ID);
    });

    it("appends numeric suffix when slug is already taken", async () => {
      // findMany returns slugs that start with "acme-corp" — the base is taken
      jest
        .mocked(prismaMock.tenant.findMany)
        .mockResolvedValueOnce([{ slug: "acme-corp" }] as never);

      await service.handleEvent(event);

      const call = jest.mocked(prismaMock.tenant.upsert).mock.calls[0][0] as {
        create: { slug: string };
      };
      expect(call.create.slug).toBe("acme-corp-1");
    });

    it("throws if no active plan exists", async () => {
      jest.mocked(prismaMock.plan.findFirst).mockResolvedValueOnce(null);

      await expect(service.handleEvent(event)).rejects.toThrow(
        /no hay planes disponibles/i
      );
    });
  });

  // ── organization.updated ──────────────────────────────────────────────────

  describe("organization.updated", () => {
    it("also calls upsert with the same workosOrgId (idempotent)", async () => {
      const event = {
        event: "organization.updated" as const,
        id: "evt_org_02",
        data: { id: "org_01", name: "Acme Corp (Renamed)" },
      };

      await service.handleEvent(event);

      expect(prismaMock.tenant.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workosOrgId: "org_01" } })
      );
    });

    it("updates the name on subsequent events", async () => {
      const event = {
        event: "organization.updated" as const,
        id: "evt_org_02",
        data: { id: "org_01", name: "New Name" },
      };

      await service.handleEvent(event);

      const call = jest.mocked(prismaMock.tenant.upsert).mock.calls[0][0] as {
        update: { name: string };
      };
      expect(call.update.name).toBe("New Name");
    });
  });

  // ── user.created ──────────────────────────────────────────────────────────

  describe("user.created", () => {
    const event = {
      event: "user.created" as const,
      id: "evt_usr_01",
      data: {
        id: "wos_user_01",
        email: "jane@example.com",
        first_name: "Jane",
        last_name: "Doe",
      },
    };

    it("does NOT call user.update when user does not exist yet", async () => {
      jest.mocked(prismaMock.user.findUnique).mockResolvedValueOnce(null);

      await service.handleEvent(event);

      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("queries by workosUserId to check for existing user", async () => {
      await service.handleEvent(event);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workosUserId: "wos_user_01" },
        })
      );
    });
  });

  // ── user.updated ──────────────────────────────────────────────────────────

  describe("user.updated", () => {
    const event = {
      event: "user.updated" as const,
      id: "evt_usr_02",
      data: {
        id: "wos_user_01",
        email: "jane.updated@example.com",
        first_name: "Jane",
        last_name: "Smith",
      },
    };

    it("calls user.update with new email when user already exists", async () => {
      jest
        .mocked(prismaMock.user.findUnique)
        .mockResolvedValueOnce({ tenantId: MOCK_TENANT_ID } as never);

      await service.handleEvent(event);

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: "jane.updated@example.com" }),
          where: { workosUserId: "wos_user_01" },
        })
      );
    });

    it("concatenates first_name and last_name into name", async () => {
      jest
        .mocked(prismaMock.user.findUnique)
        .mockResolvedValueOnce({ tenantId: MOCK_TENANT_ID } as never);

      await service.handleEvent(event);

      const call = jest.mocked(prismaMock.user.update).mock.calls[0][0] as {
        data: { name: string };
      };
      expect(call.data.name).toBe("Jane Smith");
    });

    it("falls back to email as name when both names are null", async () => {
      jest
        .mocked(prismaMock.user.findUnique)
        .mockResolvedValueOnce({ tenantId: MOCK_TENANT_ID } as never);

      await service.handleEvent({
        ...event,
        data: { ...event.data, first_name: null, last_name: undefined },
      });

      const call = jest.mocked(prismaMock.user.update).mock.calls[0][0] as {
        data: { name: string };
      };
      expect(call.data.name).toBe("jane.updated@example.com");
    });

    it("is idempotent — replaying the same event calls update with the same data", async () => {
      jest
        .mocked(prismaMock.user.findUnique)
        .mockResolvedValue({ tenantId: MOCK_TENANT_ID } as never);

      await service.handleEvent(event);
      await service.handleEvent(event); // replay

      const calls = jest.mocked(prismaMock.user.update).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0]).toStrictEqual(calls[1]);
    });
  });

  // ── organization_membership.created ──────────────────────────────────────

  describe("organization_membership.created", () => {
    const membershipEvent = {
      event: "organization_membership.created" as const,
      id: "evt_om_01",
      data: {
        id: "om_01",
        organization_id: "org_01",
        role: { slug: "admin" },
        user_id: "wos_user_01",
      },
    };

    // ── Successful flows ─────────────────────────────────────────────────

    describe("when tenant exists and user does NOT exist locally", () => {
      beforeEach(() => {
        jest
          .mocked(prismaMock.tenant.findUnique)
          .mockResolvedValueOnce({ id: MOCK_TENANT_ID } as never);

        jest.mocked(prismaMock.user.findUnique).mockResolvedValueOnce(null);
      });

      it("fetches user profile from WorkOS API", async () => {
        await service.handleEvent(membershipEvent);

        expect(
          authServiceMock.workos.userManagement.getUser
        ).toHaveBeenCalledWith("wos_user_01");
      });

      it("creates user via upsert with tenantId and role", async () => {
        await service.handleEvent(membershipEvent);

        expect(prismaMock.user.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              tenantId: MOCK_TENANT_ID,
              workosUserId: "wos_user_01",
              role: "ADMIN",
            }),
            where: { workosUserId: "wos_user_01" },
          })
        );
      });

      it("builds name from WorkOS first_name + last_name", async () => {
        await service.handleEvent(membershipEvent);

        const call = jest.mocked(prismaMock.user.upsert).mock.calls[0][0] as {
          create: { name: string };
        };
        expect(call.create.name).toBe("Jane Doe");
      });

      it("sets email from WorkOS profile", async () => {
        await service.handleEvent(membershipEvent);

        const call = jest.mocked(prismaMock.user.upsert).mock.calls[0][0] as {
          create: { email: string };
        };
        expect(call.create.email).toBe("jane@example.com");
      });
    });

    describe("when a pending user was pre-created by email", () => {
      beforeEach(() => {
        jest
          .mocked(prismaMock.tenant.findUnique)
          .mockResolvedValueOnce({ id: MOCK_TENANT_ID } as never);
        jest.mocked(prismaMock.user.findUnique).mockResolvedValueOnce(null);
        jest
          .mocked(prismaMock.user.findFirst)
          .mockResolvedValueOnce({ id: MOCK_USER_ID });
      });

      it("links the existing row to the WorkOS identity", async () => {
        await service.handleEvent(membershipEvent);

        expect(prismaMock.user.update).toHaveBeenCalledWith({
          data: {
            name: "Jane Doe",
            role: "ADMIN",
            workosUserId: "wos_user_01",
          },
          where: { id: MOCK_USER_ID },
        });
        expect(prismaMock.user.upsert).not.toHaveBeenCalled();
      });

      it("activates the pending tenant membership", async () => {
        await service.handleEvent(membershipEvent);

        expect(prismaMock.userTenant.updateMany).toHaveBeenCalledWith({
          data: {
            acceptedAt: expect.any(Date),
            status: "ACTIVE",
          },
          where: {
            tenantId: MOCK_TENANT_ID,
            userId: MOCK_USER_ID,
          },
        });
      });
    });

    describe("when tenant exists and user ALREADY exists locally", () => {
      beforeEach(() => {
        jest
          .mocked(prismaMock.tenant.findUnique)
          .mockResolvedValueOnce({ id: MOCK_TENANT_ID } as never);

        jest.mocked(prismaMock.user.findUnique).mockResolvedValueOnce({
          id: MOCK_USER_ID,
          tenantId: "old_tenant",
        } as never);
      });

      it("does NOT call WorkOS API (user already exists)", async () => {
        await service.handleEvent(membershipEvent);

        expect(
          authServiceMock.workos.userManagement.getUser
        ).not.toHaveBeenCalled();
      });

      it("updates user tenantId and role via user.update", async () => {
        await service.handleEvent(membershipEvent);

        expect(prismaMock.user.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              tenantId: MOCK_TENANT_ID,
              role: "ADMIN",
            }),
            where: { workosUserId: "wos_user_01" },
          })
        );
      });

      it("is idempotent — replaying the same membership event updates same fields", async () => {
        jest.mocked(prismaMock.user.findUnique).mockResolvedValue({
          id: MOCK_USER_ID,
          tenantId: MOCK_TENANT_ID,
        } as never);

        jest
          .mocked(prismaMock.tenant.findUnique)
          .mockResolvedValue({ id: MOCK_TENANT_ID } as never);

        await service.handleEvent(membershipEvent);
        await service.handleEvent(membershipEvent); // replay

        const calls = jest.mocked(prismaMock.user.update).mock.calls;
        expect(calls).toHaveLength(2);
        expect(calls[0]).toStrictEqual(calls[1]);
      });
    });

    // ── Tenant not found ──────────────────────────────────────────────────

    describe("when tenant does NOT exist", () => {
      beforeEach(() => {
        jest.mocked(prismaMock.tenant.findUnique).mockResolvedValueOnce(null);
      });

      it("returns without creating or updating any user", async () => {
        await service.handleEvent(membershipEvent);

        expect(prismaMock.user.update).not.toHaveBeenCalled();
        expect(prismaMock.user.upsert).not.toHaveBeenCalled();
        expect(
          authServiceMock.workos.userManagement.getUser
        ).not.toHaveBeenCalled();
      });

      it("resolves tenant by workosOrgId", async () => {
        await service.handleEvent(membershipEvent);

        expect(prismaMock.tenant.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { workosOrgId: "org_01" },
          })
        );
      });
    });

    // ── Role mapping ──────────────────────────────────────────────────────

    describe("role mapping", () => {
      beforeEach(() => {
        jest
          .mocked(prismaMock.tenant.findUnique)
          .mockResolvedValue({ id: MOCK_TENANT_ID } as never);
        jest.mocked(prismaMock.user.findUnique).mockResolvedValue(null);
      });

      it("maps 'admin' slug to ADMIN", async () => {
        await service.handleEvent({
          ...membershipEvent,
          data: { ...membershipEvent.data, role: { slug: "admin" } },
        });

        const call = jest.mocked(prismaMock.user.upsert).mock.calls[0][0] as {
          create: { role: string };
        };
        expect(call.create.role).toBe("ADMIN");
      });

      it("maps 'member' slug to MANAGER", async () => {
        await service.handleEvent({
          ...membershipEvent,
          data: { ...membershipEvent.data, role: { slug: "member" } },
        });

        const call = jest.mocked(prismaMock.user.upsert).mock.calls[0][0] as {
          create: { role: string };
        };
        expect(call.create.role).toBe("MANAGER");
      });

      it("defaults to ADMIN for unknown role slugs", async () => {
        await service.handleEvent({
          ...membershipEvent,
          data: { ...membershipEvent.data, role: { slug: "custom_role" } },
        });

        const call = jest.mocked(prismaMock.user.upsert).mock.calls[0][0] as {
          create: { role: string };
        };
        expect(call.create.role).toBe("ADMIN");
      });

      it("defaults to ADMIN when role is undefined", async () => {
        await service.handleEvent({
          ...membershipEvent,
          data: { ...membershipEvent.data, role: undefined },
        });

        const call = jest.mocked(prismaMock.user.upsert).mock.calls[0][0] as {
          create: { role: string };
        };
        expect(call.create.role).toBe("ADMIN");
      });

      it("defaults to ADMIN when role is null", async () => {
        await service.handleEvent({
          ...membershipEvent,
          data: { ...membershipEvent.data, role: null },
        });

        const call = jest.mocked(prismaMock.user.upsert).mock.calls[0][0] as {
          create: { role: string };
        };
        expect(call.create.role).toBe("ADMIN");
      });
    });
  });
});
