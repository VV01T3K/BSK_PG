import { defineConfig, devices } from "@playwright/test";

const CI = Boolean(process.env.CI);

/**
 * End-to-end tests for the Trusted Third Party security flow.
 *
 * The ttp and server apps keep global in-memory state in a single process, so the
 * suite runs serially (one worker, no parallelism) and resets state between tests.
 * In-browser RSA key generation during Register/Authenticate is slow, hence the
 * generous test/expect timeouts.
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
  // Register generates two 4096-bit RSA key pairs in-browser with node-forge's
  // synchronous path, which freezes the page for tens of seconds. The click that
  // triggers it absorbs that time, so actionTimeout is uncapped (bounded by the
  // per-test timeout) and the test/expect budgets are generous.
  timeout: 240_000,
  expect: { timeout: 60_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    actionTimeout: 0,
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
