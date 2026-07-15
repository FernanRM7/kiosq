import db from "../index";
import type { Product } from "../index";

export async function populateProducts(products: Product[]): Promise<void> {
  await db.products.clear();

  if (products.length > 0) {
    await db.products.bulkPut(products);
  }
}

export function getLocalProducts(): Promise<Product[]> {
  return db.products.toArray();
}

export function getLocalProduct(
  productId: string
): Promise<Product | undefined> {
  return db.products.get(productId);
}

export function clearLocalProducts(): Promise<void> {
  return db.products.clear();
}
