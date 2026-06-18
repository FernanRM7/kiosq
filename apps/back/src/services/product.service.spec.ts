import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { ProductService } from "./product.service";

const session = { userId: "workos-user-1" } as never;

function buildProductRecord(overrides: Record<string, unknown> = {}) {
  return {
    barcode: null,
    branches: [],
    category: null,
    categoryId: null,
    cost: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    description: null,
    id: "product-1",
    imageUrl: null,
    isActive: true,
    name: "Café americano",
    price: { toString: () => "25.00" },
    sku: "CAFE-001",
    taxRate: { toString: () => "0.1600" },
    tenantId: "tenant-1",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function buildService() {
  const tx = {
    category: {
      findFirst: jest.fn(),
    },
    product: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    productBranch: {
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
      callback(tx)
    ),
    product: {
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
    service: new ProductService(prisma as never),
    tx,
  };
}

describe("ProductService", () => {
  it("creates products without moving inventory", async () => {
    const { service, tx } = buildService();
    const productRecord = buildProductRecord();

    tx.product.create.mockResolvedValue(productRecord);

    const result = await service.createProduct(session, {
      name: "Café americano",
      price: 25,
      sku: "CAFE-001",
    });

    expect(result.totalStock).toBe(0);
    expect(tx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          branches: expect.anything(),
          stockMovements: expect.anything(),
        }),
      })
    );
    expect(tx.productBranch.create).not.toHaveBeenCalled();
    expect(tx.productBranch.upsert).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it("updates catalog fields without changing stock", async () => {
    const { service, tx } = buildService();

    tx.product.findFirst.mockResolvedValue({ id: "product-1" });
    tx.product.update.mockResolvedValue(
      buildProductRecord({ name: "Café latte", sku: "LATTE-001" })
    );

    const result = await service.updateProduct(session, "product-1", {
      name: "Café latte",
      price: 30,
      sku: "LATTE-001",
    });

    expect(result.name).toBe("Café latte");
    expect(tx.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          branches: expect.anything(),
          stockMovements: expect.anything(),
        }),
      })
    );
    expect(tx.productBranch.update).not.toHaveBeenCalled();
    expect(tx.productBranch.upsert).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it("soft deletes products instead of deleting inventory history", async () => {
    const { service, tx } = buildService();

    tx.product.findFirst.mockResolvedValue({ id: "product-1" });
    tx.product.update.mockResolvedValue(
      buildProductRecord({ isActive: false })
    );

    const result = await service.deleteProduct(session, "product-1");

    expect(result.isActive).toBe(false);
    expect(tx.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isActive: false },
        where: { id: "product-1" },
      })
    );
    expect(tx.productBranch.update).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it("returns not found when deleting a product from another tenant", async () => {
    const { service, tx } = buildService();

    tx.product.findFirst.mockResolvedValue(null);

    await expect(service.deleteProduct(session, "product-1")).rejects.toThrow(
      NotFoundException
    );
  });

  it("maps unique SKU violations to conflict errors", async () => {
    const { service, tx } = buildService();

    tx.product.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        clientVersion: "6.19.3",
        code: "P2002",
      })
    );

    await expect(
      service.createProduct(session, {
        name: "Café americano",
        price: 25,
        sku: "CAFE-001",
      })
    ).rejects.toThrow(ConflictException);
  });
});
