import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI builds in an earlier step and sets E2E_SKIP_BUILD.
    command: `${process.env.E2E_SKIP_BUILD ? "" : "npm run build && "}npm run start -- --port ${PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      // Fully offline: mock data, mock OAuth, in-memory cache.
      DATA_PROVIDER: "mock",
      GITHUB_TOKEN: "",
      OAUTH_PROVIDER: "mock",
      REDIS_URL: "",
      SESSION_SECRET: "e2e-only-session-secret-32-characters-long",
      SITE_URL: baseURL,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
