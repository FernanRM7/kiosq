import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { SupplierService } from "./supplier.service";

const session = { userId: "workos-user-1" } as never;

function buildSupplierRecord(overrides: Record<string, unknown> = {}) {
  return {
    address: "Calle Falsa 123",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    email: "contacto@proveedor.com",
    id: "supplier-1",
    isActive: true,
    name: "Proveedor X",
    phone: "+525512345678",
    rfc: "ABC123456XYZ",
    tenantId: "tenant-1",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function buildService() {
  const tx = {
    supplier: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
      callback(tx)
    ),
    supplier: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ isActive: true, tenantId: "tenant-1" }),
    },
  };

  return {
    prisma,
    service: new SupplierService(prisma as never),
    tx,
  };
}

describe("SupplierService", () => {
  describe("listSuppliers", () => {
    it("lists active and deleted suppliers for the active tenant", async () => {
      const { service, prisma } = buildService();

      prisma.supplier.findMany
        .mockResolvedValueOnce([
          buildSupplierRecord({ name: "Proveedor X" }),
          buildSupplierRecord({ id: "supplier-2", name: "Proveedor Y" }),
        ])
        .mockResolvedValueOnce([
          buildSupplierRecord({
            id: "supplier-3",
            isActive: false,
            name: "Proveedor Z",
          }),
        ]);

      const result = await service.listSuppliers(session);

      expect(prisma.supplier.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { isActive: true, tenantId: "tenant-1" },
        })
      );
      expect(prisma.supplier.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { isActive: false, tenantId: "tenant-1" },
        })
      );
      expect(result.active).toHaveLength(2);
      expect(result.active[0].name).toBe("Proveedor X");
      expect(result.deleted).toHaveLength(1);
      expect(result.deleted[0].name).toBe("Proveedor Z");
    });

    it("rejects when the user has no active workspace", async () => {
      const { service, prisma } = buildService();

      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.listSuppliers(session)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe("getSupplier", () => {
    it("returns a supplier by id", async () => {
      const { service, prisma } = buildService();

      prisma.supplier.findFirst.mockResolvedValue(buildSupplierRecord());

      const result = await service.getSupplier(session, "supplier-1");

      expect(prisma.supplier.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "supplier-1", tenantId: "tenant-1" },
        })
      );
      expect(result.id).toBe("supplier-1");
      expect(result.name).toBe("Proveedor X");
    });

    it("returns not found when supplier does not exist", async () => {
      const { service, prisma } = buildService();

      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(service.getSupplier(session, "nonexistent")).rejects.toThrow(
        NotFoundException
      );
    });

    it("returns not found when supplier belongs to another tenant", async () => {
      const { service, prisma } = buildService();

      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(service.getSupplier(session, "supplier-1")).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe("createSupplier", () => {
    it("creates a supplier with all fields", async () => {
      const { service, prisma } = buildService();

      prisma.supplier.create.mockResolvedValue(buildSupplierRecord());

      const result = await service.createSupplier(session, {
        address: "Calle Falsa 123",
        email: "contacto@proveedor.com",
        name: "Proveedor X",
        phone: "+525512345678",
        rfc: "ABC123456XYZ",
      });

      expect(prisma.supplier.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            address: "Calle Falsa 123",
            email: "contacto@proveedor.com",
            name: "Proveedor X",
            phone: "+525512345678",
            rfc: "ABC123456XYZ",
            tenantId: "tenant-1",
          },
        })
      );
      expect(result.name).toBe("Proveedor X");
      expect(result.rfc).toBe("ABC123456XYZ");
    });

    it("creates a supplier with only name", async () => {
      const { service, prisma } = buildService();

      prisma.supplier.create.mockResolvedValue(
        buildSupplierRecord({
          address: null,
          email: null,
          phone: null,
          rfc: null,
        })
      );

      const result = await service.createSupplier(session, {
        name: "Proveedor X",
      });

      expect(prisma.supplier.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            address: null,
            email: null,
            name: "Proveedor X",
            phone: null,
            rfc: null,
            tenantId: "tenant-1",
          },
        })
      );
      expect(result.rfc).toBeNull();
    });

    it("maps unique constraint violations to conflict errors", async () => {
      const { service, prisma } = buildService();

      prisma.supplier.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          clientVersion: "6.19.3",
          code: "P2002",
        })
      );

      await expect(
        service.createSupplier(session, { name: "Proveedor X" })
      ).rejects.toThrow(ConflictException);
    });

    it("rejects when the user has no active workspace", async () => {
      const { service, prisma } = buildService();

      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createSupplier(session, { name: "Proveedor X" })
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("updateSupplier", () => {
    it("updates supplier fields", async () => {
      const { service, tx } = buildService();

      tx.supplier.findFirst.mockResolvedValue({ id: "supplier-1" });
      tx.supplier.update.mockResolvedValue(
        buildSupplierRecord({
          name: "Proveedor Actualizado",
          phone: "+529998887777",
        })
      );

      const result = await service.updateSupplier(session, "supplier-1", {
        name: "Proveedor Actualizado",
        phone: "+529998887777",
      });

      expect(tx.supplier.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "supplier-1", isActive: true, tenantId: "tenant-1" },
        })
      );
      expect(tx.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: "Proveedor Actualizado", phone: "+529998887777" },
          where: { id: "supplier-1" },
        })
      );
      expect(result.name).toBe("Proveedor Actualizado");
      expect(result.phone).toBe("+529998887777");
    });

    it("clears optional fields when null is sent", async () => {
      const { service, tx } = buildService();

      tx.supplier.findFirst.mockResolvedValue({ id: "supplier-1" });
      tx.supplier.update.mockResolvedValue(
        buildSupplierRecord({ email: null, phone: null, rfc: null })
      );

      const result = await service.updateSupplier(session, "supplier-1", {
        email: null,
        phone: null,
        rfc: null,
      });

      expect(tx.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { email: null, phone: null, rfc: null },
          where: { id: "supplier-1" },
        })
      );
      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
      expect(result.rfc).toBeNull();
    });

    it("returns not found when supplier does not exist", async () => {
      const { service, tx } = buildService();

      tx.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSupplier(session, "supplier-1", { name: "Otro" })
      ).rejects.toThrow(NotFoundException);
    });

    it("returns not found when supplier belongs to another tenant", async () => {
      const { service, tx } = buildService();

      tx.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSupplier(session, "supplier-1", { name: "Otro" })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("deleteSupplier", () => {
    it("soft deletes a supplier by setting isActive false", async () => {
      const { service, tx } = buildService();

      tx.supplier.findFirst.mockResolvedValue({ id: "supplier-1" });
      tx.supplier.update.mockResolvedValue(
        buildSupplierRecord({ isActive: false })
      );

      const result = await service.deleteSupplier(session, "supplier-1");

      expect(tx.supplier.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "supplier-1", isActive: true, tenantId: "tenant-1" },
        })
      );
      expect(tx.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
          where: { id: "supplier-1" },
        })
      );
      expect(result.isActive).toBe(false);
    });

    it("returns not found when deleting a supplier that is already inactive", async () => {
      const { service, tx } = buildService();

      tx.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteSupplier(session, "supplier-1")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("restoreSupplier", () => {
    it("restores a soft-deleted supplier", async () => {
      const { service, tx } = buildService();

      tx.supplier.findFirst.mockResolvedValue({ id: "supplier-1" });
      tx.supplier.update.mockResolvedValue(
        buildSupplierRecord({ isActive: true })
      );

      const result = await service.restoreSupplier(session, "supplier-1");

      expect(tx.supplier.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "supplier-1", isActive: false, tenantId: "tenant-1" },
        })
      );
      expect(tx.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: true },
          where: { id: "supplier-1" },
        })
      );
      expect(result.isActive).toBe(true);
    });

    it("returns not found when restoring a supplier that is already active", async () => {
      const { service, tx } = buildService();

      tx.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.restoreSupplier(session, "supplier-1")
      ).rejects.toThrow(NotFoundException);
    });
  });
});
