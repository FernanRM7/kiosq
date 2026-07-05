import { test, expect } from "@playwright/test";

test("Debe proteger el módulo de productos", async ({ page }) => {
  await page.goto("/dashboard/products");

  await expect(page).toHaveURL(/login/u);
});
