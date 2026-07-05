import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  forbidOnly: !!process.env.CI,

  fullyParallel: true,

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  reporter: "html",

  retries: process.env.CI ? 2 : 0,

  testDir: "./tests",

  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    trace: "on-first-retry",
  },

  webServer: {
    command: "npm run dev --prefix apps/front",
    reuseExistingServer: true,
    timeout: 120_000,
    url: "http://localhost:5173",
  },
});
