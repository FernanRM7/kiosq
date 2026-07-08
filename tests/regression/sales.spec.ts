import { test, expect } from "@playwright/test";

test("Debe proteger el módulo de ventas", async ({ page }) => {
  await page.goto("/dashboard/sales");

  await expect(page).toHaveURL(/login/u);
});
