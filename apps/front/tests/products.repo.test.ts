import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Product } from "@/db";
import {
  clearLocalProducts,
  getLocalProduct,
  getLocalProducts,
  populateProducts,
} from "@/db/repositories/products.repo";

import { deleteKiosqDb } from "./setup";

const mockProducts: Product[] = [
  {
    id: "prod-1",
    isActive: true,
    name: "Coca Cola 600ml",
    price: 18.5,
    sku: "COCA-600",
    taxRate: 0.16,
    totalStock: 50,
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "prod-2",
    isActive: true,
    name: "Sabritas 45g",
    price: 15,
    sku: "SAB-45",
    taxRate: 0.16,
    totalStock: 100,
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
];

describe("products.repo", () => {
  beforeEach(async () => {
    await deleteKiosqDb();
  });

  afterEach(async () => {
    await clearLocalProducts();
  });

  it("populateProducts writes products and getLocalProducts returns them", async () => {
    await populateProducts(mockProducts);

    const stored = await getLocalProducts();
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({
      id: "prod-1",
      name: "Coca Cola 600ml",
      price: 18.5,
      sku: "COCA-600",
    });
    expect(stored[1]).toMatchObject({
      id: "prod-2",
      name: "Sabritas 45g",
      price: 15,
    });
  });

  it("getLocalProduct returns a product by id", async () => {
    await populateProducts(mockProducts);

    const product = await getLocalProduct("prod-1");
    expect(product).toBeDefined();
    expect(product!.name).toBe("Coca Cola 600ml");
    expect(product!.price).toBe(18.5);
  });

  it("getLocalProduct returns undefined for non-existent id", async () => {
    await populateProducts(mockProducts);

    const product = await getLocalProduct("nonexistent");
    expect(product).toBeUndefined();
  });

  it("populateProducts replaces existing data", async () => {
    await populateProducts(mockProducts);
    const updated = {
      ...mockProducts[0],
      price: 20,
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    await populateProducts([updated]);

    const stored = await getLocalProducts();
    expect(stored).toHaveLength(1);
    expect(stored[0].price).toBe(20);
  });

  it("clearLocalProducts removes all products", async () => {
    await populateProducts(mockProducts);
    await clearLocalProducts();

    const stored = await getLocalProducts();
    expect(stored).toHaveLength(0);
  });

  it("populateProducts with empty array clears existing catalog", async () => {
    await populateProducts(mockProducts);
    await expect(getLocalProducts()).resolves.toHaveLength(2);

    await populateProducts([]);

    const stored = await getLocalProducts();
    expect(stored).toHaveLength(0);
  });

  it("Dexie product round-trips the full Product shape including optional fields", async () => {
    const fullProduct: Product = {
      barcode: "123456",
      category: { id: "cat-1", name: "Category 1" },
      categoryId: "cat-1",
      cost: 50,
      createdAt: "2024-01-01T00:00:00.000Z",
      description: "A full product",
      id: "prod-full",
      imageUrl: "https://example.com/img.jpg",
      isActive: true,
      name: "Full Product",
      price: 100,
      sku: "FULL-001",
      taxRate: 0.16,
      totalStock: 10,
      updatedAt: "2024-01-01T00:00:00.000Z",
    };
    await populateProducts([fullProduct]);

    const stored = await getLocalProducts();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject(fullProduct);
  });
});
