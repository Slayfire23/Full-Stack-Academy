import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running app. Locally:
 *   npm run build && npm run test:e2e        (starts `npm run start` automatically)
 * The database must be migrated and seeded first (npm run db:deploy && npm run db:seed).
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  // The desktop and mobile projects share one webServer and one persistent database with no
  // reset between tests. Running them as separate parallel workers (Playwright's default)
  // sends concurrent requests for the same routes and intermittently renders duplicated DOM
  // content under that concurrency — a real timing issue, reproduced and confirmed by running
  // the exact same suite with workers: 1 instead. Until that's root-caused, keep this at 1.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run start",
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // The suite registers a fresh user per test, from one IP, across both projects sharing
    // this one server — well over the production default (5/hour/IP). Test-only override.
    env: { PORT: String(PORT), REGISTER_RATE_LIMIT_PER_HOUR: "100" },
  },
});
