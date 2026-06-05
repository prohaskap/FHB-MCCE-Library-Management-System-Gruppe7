// @ts-check
const { defineConfig, devices } = require("@playwright/test");

/**
 * Playwright configuration for Group F, Domain G7.
 * Covers API tests (apiRequest context), Integration (multi-step API flows),
 * and E2E (Chromium browser against the local SUT UI).
 */
module.exports = defineConfig({
  testDir: "./tests",
  testIgnore: ["**/unit/**"], // Unit tests run via vitest separately
  fullyParallel: false, // SUT is single SQLite in-memory DB; isolation > parallelism
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // single worker to avoid cross-test interference on shared DB
  timeout: 30_000,
  expect: { timeout: 5_000 },

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],

  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    extraHTTPHeaders: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "api",
      testDir: "./tests/api",
    },
    {
      name: "integration",
      testDir: "./tests/integration",
    },
    {
      name: "e2e-chromium",
      testDir: "./tests/e2e",
      use: { ...devices["Desktop Chrome"], headless: true },
    },
  ],
});
