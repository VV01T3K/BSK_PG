import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end coverage of the Trusted Third Party security flow UI.
 *
 * The ttp and server processes share global in-memory state, so these tests run
 * serially and reset the environment before each test (see beforeEach). State is
 * read from the "Current State" panel and from button enabled/disabled gating,
 * which are the deterministic signals the page exposes.
 */
test.describe.configure({ mode: "serial" });

const button = (page: Page, name: string) => page.getByRole("button", { name });

/**
 * Each action button disables itself (`disabled:pointer-events-none`) for the
 * duration of its async handler, which makes Playwright's actionability-retrying
 * `.click()` loop until timeout. We wait for the button to be ready, then dispatch
 * a single click directly so exactly one handler runs and the call resolves.
 */
async function clickButton(page: Page, name: string) {
  const target = button(page, name);
  await expect(target).toBeEnabled();
  await target.dispatchEvent("click");
}

/** Value cell for a "Current State" row, located via its (exact) label sibling. */
const stateValue = (page: Page, label: string) =>
  page.getByText(label, { exact: true }).locator("xpath=following-sibling::span");

async function gotoCleanState(page: Page) {
  await page.goto("/");
  await clickButton(page, "Reset");
  await expect(stateValue(page, "User")).toHaveText("not registered");
  await expect(stateValue(page, "Session")).toHaveText("not established");
}

async function register(page: Page) {
  await clickButton(page, "Register");
  await expect(stateValue(page, "User")).toHaveText("registered");
  await expect(stateValue(page, "Server")).toHaveText("registered");
}

async function startSession(page: Page) {
  await clickButton(page, "Start session");
  await expect(stateValue(page, "Session")).not.toHaveText("not established");
  await expect(stateValue(page, "Session")).not.toBeEmpty();
}

async function selectTextFile(page: Page) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "demo.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello from playwright over the encrypted session"),
  });
  await expect(stateValue(page, "Selected file")).toContainText("demo.txt");
}

test.beforeEach(async ({ page }) => {
  await gotoCleanState(page);
});

test("gates each step until its prerequisites are met", async ({ page }) => {
  await expect(button(page, "Register")).toBeEnabled();
  await expect(button(page, "Reset")).toBeEnabled();
  await expect(button(page, "Start session")).toBeDisabled();
  await expect(button(page, "Upload selected file")).toBeDisabled();
  await expect(button(page, "Run test")).toBeDisabled();
  await expect(button(page, "Close session")).toBeDisabled();
});

test("completes the register -> authenticate -> file service happy path", async ({ page }) => {
  await register(page);
  await expect(button(page, "Start session")).toBeEnabled();
  await expect(button(page, "Run test")).toBeEnabled();

  await startSession(page);
  await clickButton(page, "Upload file");
  await selectTextFile(page);

  await button(page, "Upload selected file").click();
  await expect(stateValue(page, "Service")).toHaveText(/demo\.txt stored, \d+ bytes/);
  await expect(stateValue(page, "Current server file")).toContainText("demo.txt");
  await expect(page.getByText("hello from playwright over the encrypted session")).toBeVisible();
  await expect(page.getByText("Encrypted AES-GCM payload")).toBeVisible();
  await expect(page.getByText('"ciphertext"')).toBeVisible();

  await clickButton(page, "View file");
  await clickButton(page, "View current uploaded file");
  await expect(stateValue(page, "Current server file")).toContainText("demo.txt");
  await expect(page.getByText("Encrypted AES-GCM payload")).toBeVisible();

  // The destructive error alert must never have rendered during the flow.
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("rejects a forged certificate", async ({ page }) => {
  await register(page);

  await button(page, "Run test").click();
  const forged = stateValue(page, "Forged certificate");
  await expect(forged).not.toHaveText("not tested");
  await expect(forged).not.toBeEmpty();
  // No error alert: rejection is the expected, handled outcome.
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("closes a session without dropping registration", async ({ page }) => {
  await register(page);
  await startSession(page);

  await button(page, "Close session").click();
  await expect(stateValue(page, "Session")).toHaveText("not established");
  await expect(button(page, "Upload selected file")).toBeDisabled();
  await expect(button(page, "Close session")).toBeDisabled();

  // Registration survives a session close.
  await expect(stateValue(page, "User")).toHaveText("registered");
  await expect(stateValue(page, "Server")).toHaveText("registered");
});

test("reset returns every row to its initial value", async ({ page }) => {
  await register(page);
  await startSession(page);
  await clickButton(page, "Upload file");
  await selectTextFile(page);
  await button(page, "Upload selected file").click();
  await expect(stateValue(page, "Service")).toHaveText(/demo\.txt stored, \d+ bytes/);

  await button(page, "Reset").click();
  await expect(stateValue(page, "User")).toHaveText("not registered");
  await expect(stateValue(page, "Server")).toHaveText("not registered");
  await expect(stateValue(page, "Session")).toHaveText("not established");
  await expect(stateValue(page, "Service")).toHaveText("not used");
  await expect(stateValue(page, "Selected file")).toHaveText("start a session first");
  await expect(stateValue(page, "Current server file")).toHaveText(
    "Choose a service after authentication.",
  );
  await expect(stateValue(page, "Forged certificate")).toHaveText("not tested");
});
