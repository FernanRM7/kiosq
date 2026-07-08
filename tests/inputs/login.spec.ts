import { test, expect } from "@playwright/test";

test("Debe mostrar la página de inicio de sesión", async ({ page }) => {
  await page.goto("/login");

  await expect(page).toHaveURL(/login/u);

  await expect(
    page.getByRole("button", { name: "Continue with WorkOS" })
  ).toBeVisible();
});
