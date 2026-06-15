import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";

import { PrismaService } from "../lib/prisma.service";
import { SyncService } from "./sync.service";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

const MOCK_PLAN_ID = "plan_default_01";

function makeMockPrisma() {
  return {
    plan: {
      findFirst: jest.fn().mockResolvedValue({ id: MOCK_PLAN_ID }),
    },
    tenant: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ id: "tenant_01", slug: "acme" }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ id: "user_01" }),
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SyncService", () => {
  let service: SyncService;
  let prismaMock: ReturnType<typeof makeMockPrisma>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock = makeMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: PrismaService, useValue: prismaMock },
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

      const call = jest.mocked(prismaMock.tenant.upsert).mock.calls[0][0];
      expect(call.create.slug).toBe("acme-corp");
    });

    it("strips diacritics from slug", async () => {
      await service.handleEvent({
        ...event,
        data: { ...event.data, name: "Tiendá Ópticá" },
      });

      const call = jest.mocked(prismaMock.tenant.upsert).mock.calls[0][0];
      expect(call.create.slug).toBe("tienda-optica");
    });

    it("is idempotent — upsert does NOT change slug on update", async () => {
      await service.handleEvent(event);

      const call = jest.mocked(prismaMock.tenant.upsert).mock.calls[0][0];
      // update payload must NOT contain slug
      expect(call.update).not.toHaveProperty("slug");
    });

    it("uses the default plan ID from the cheapest active plan", async () => {
      await service.handleEvent(event);

      expect(prismaMock.plan.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } })
      );

      const call = jest.mocked(prismaMock.tenant.upsert).mock.calls[0][0];
      expect(call.create.planId).toBe(MOCK_PLAN_ID);
    });

    it("appends numeric suffix when slug is already taken", async () => {
      // First call: slug "acme-corp" exists, second doesn't
      jest
        .mocked(prismaMock.tenant.findUnique)
        .mockResolvedValueOnce({ id: "existing_tenant" } as never) // slug taken
        .mockResolvedValueOnce(null); // acme-corp-1 is free

      await service.handleEvent(event);

      const call = jest.mocked(prismaMock.tenant.upsert).mock.calls[0][0];
      expect(call.create.slug).toBe("acme-corp-1");
    });

    it("throws if no active plan exists", async () => {
      jest.mocked(prismaMock.plan.findFirst).mockResolvedValueOnce(null);

      await expect(service.handleEvent(event)).rejects.toThrow(
        /no active plans/i
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

      const call = jest.mocked(prismaMock.tenant.upsert).mock.calls[0][0];
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
        .mockResolvedValueOnce({ tenantId: "tenant_01" } as never);

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
        .mockResolvedValueOnce({ tenantId: "tenant_01" } as never);

      await service.handleEvent(event);

      const call = jest.mocked(prismaMock.user.update).mock.calls[0][0];
      expect(call.data.name).toBe("Jane Smith");
    });

    it("falls back to email as name when both names are null", async () => {
      jest
        .mocked(prismaMock.user.findUnique)
        .mockResolvedValueOnce({ tenantId: "tenant_01" } as never);

      await service.handleEvent({
        ...event,
        data: {
          ...event.data,
          first_name: null,
          last_name: undefined,
        },
      });

      const call = jest.mocked(prismaMock.user.update).mock.calls[0][0];
      expect(call.data.name).toBe("jane.updated@example.com");
    });

    it("is idempotent — replaying the same event calls update with the same data", async () => {
      jest
        .mocked(prismaMock.user.findUnique)
        .mockResolvedValue({ tenantId: "tenant_01" } as never);

      await service.handleEvent(event);
      await service.handleEvent(event); // replay

      const calls = jest.mocked(prismaMock.user.update).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0]).toStrictEqual(calls[1]); // same args
    });
  });
});
