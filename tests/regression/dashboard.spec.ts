import { test, expect } from "@playwright/test";

test("Debe redirigir al login cuando no existe sesión", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/login/u);
});
