import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { CategoryService } from "./category.service";

const session = { userId: "workos-user-1" } as never;

function buildCategoryRecord(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id: "category-1",
    isActive: true,
    name: "Bebidas",
    tenantId: "tenant-1",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function buildService() {
  const tx = {
    category: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
      callback(tx)
    ),
    category: {
      create: jest.fn(),
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
    service: new CategoryService(prisma as never),
    tx,
  };
}

describe("CategoryService", () => {
  it("lists active and deleted categories for the active tenant", async () => {
    const { service, prisma } = buildService();

    prisma.category.findMany
      .mockResolvedValueOnce([
        buildCategoryRecord({ name: "Bebidas" }),
        buildCategoryRecord({ id: "category-2", name: "Snacks" }),
      ])
      .mockResolvedValueOnce([
        buildCategoryRecord({
          id: "category-3",
          isActive: false,
          name: "Varios",
        }),
      ]);

    const result = await service.listCategories(session);

    expect(prisma.category.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { isActive: true, tenantId: "tenant-1" },
      })
    );
    expect(prisma.category.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { isActive: false, tenantId: "tenant-1" },
      })
    );
    expect(result.active).toHaveLength(2);
    expect(result.active[0].name).toBe("Bebidas");
    expect(result.deleted).toHaveLength(1);
    expect(result.deleted[0].name).toBe("Varios");
  });

  it("creates a category", async () => {
    const { service, prisma } = buildService();

    prisma.category.create.mockResolvedValue(buildCategoryRecord());

    const result = await service.createCategory(session, { name: "Bebidas" });

    expect(prisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: "Bebidas", tenantId: "tenant-1" },
      })
    );
    expect(result.name).toBe("Bebidas");
  });

  it("updates a category name", async () => {
    const { service, tx } = buildService();

    tx.category.findFirst.mockResolvedValue({ id: "category-1" });
    tx.category.update.mockResolvedValue(
      buildCategoryRecord({ name: "Bebidas frías" })
    );

    const result = await service.updateCategory(session, "category-1", {
      name: "Bebidas frías",
    });

    expect(tx.category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "category-1", isActive: true, tenantId: "tenant-1" },
      })
    );
    expect(tx.category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: "Bebidas frías" },
        where: { id: "category-1" },
      })
    );
    expect(result.name).toBe("Bebidas frías");
  });

  it("soft deletes a category by setting isActive false", async () => {
    const { service, tx } = buildService();

    tx.category.findFirst.mockResolvedValue({ id: "category-1" });
    tx.category.update.mockResolvedValue(
      buildCategoryRecord({ isActive: false })
    );

    const result = await service.deleteCategory(session, "category-1");

    expect(tx.category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "category-1", isActive: true, tenantId: "tenant-1" },
      })
    );
    expect(tx.category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isActive: false },
        where: { id: "category-1" },
      })
    );
    expect(result.isActive).toBe(false);
  });

  it("restores a soft-deleted category", async () => {
    const { service, tx } = buildService();

    tx.category.findFirst.mockResolvedValue({ id: "category-1" });
    tx.category.update.mockResolvedValue(
      buildCategoryRecord({ isActive: true })
    );

    const result = await service.restoreCategory(session, "category-1");

    expect(tx.category.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "category-1", isActive: false, tenantId: "tenant-1" },
      })
    );
    expect(tx.category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isActive: true },
        where: { id: "category-1" },
      })
    );
    expect(result.isActive).toBe(true);
  });

  it("returns not found when updating a category from another tenant", async () => {
    const { service, tx } = buildService();

    tx.category.findFirst.mockResolvedValue(null);

    await expect(
      service.updateCategory(session, "category-1", { name: "Otro" })
    ).rejects.toThrow(NotFoundException);
  });

  it("returns not found when deleting a category that is already inactive", async () => {
    const { service, tx } = buildService();

    tx.category.findFirst.mockResolvedValue(null);

    await expect(service.deleteCategory(session, "category-1")).rejects.toThrow(
      NotFoundException
    );
  });

  it("returns not found when restoring a category that is already active", async () => {
    const { service, tx } = buildService();

    tx.category.findFirst.mockResolvedValue(null);

    await expect(
      service.restoreCategory(session, "category-1")
    ).rejects.toThrow(NotFoundException);
  });

  it("maps unique name violations to conflict errors", async () => {
    const { service, prisma } = buildService();

    prisma.category.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        clientVersion: "6.19.3",
        code: "P2002",
      })
    );

    await expect(
      service.createCategory(session, { name: "Bebidas" })
    ).rejects.toThrow(ConflictException);
  });

  it("rejects when the user has no active workspace", async () => {
    const { service, prisma } = buildService();

    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.listCategories(session)).rejects.toThrow(
      ForbiddenException
    );
  });
});
