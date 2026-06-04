import { defineConfig, devices } from "@playwright/test";

const CI = Boolean(process.env.CI);

/**
 * End-to-end tests for the Trusted Third Party security flow.
 *
 * The ttp and server apps keep global in-memory state in a single process, so the
 * suite runs serially (one worker, no parallelism) and resets state between tests.
 */
export default defineConfig({
  // Unit tests (bun:test, *.test.ts) and e2e tests (*.e2e.ts) share tests/; the
  // testMatch keeps Playwright to *.e2e.ts and bun's runner ignores *.e2e.ts.
  testDir: "./tests",
  testMatch: /\.e2e\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: CI,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    actionTimeout: 15_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "bun run --filter ttp dev",
      url: "http://localhost:3001/",
      reuseExistingServer: !CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "bun run --filter server dev",
      url: "http://localhost:3002/",
      reuseExistingServer: !CI,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "bun run --filter client dev",
      url: "http://localhost:3000/",
      reuseExistingServer: !CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
