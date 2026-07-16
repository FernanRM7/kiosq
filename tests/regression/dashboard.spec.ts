import { test, expect } from "@playwright/test";

test("Debe mostrar el dashboard cuando el usuario tiene una sesión válida", async ({
  page,
}) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/dashboard/);

  await expect(
    page.getByRole("heading", { name: "Dashboard" })
  ).toBeVisible();
});