import { expect, test, type Page } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";

const LANDLORD_EMAIL =
  process.env.PLAYWRIGHT_HOST_EMAIL ||
  process.env.PLAYWRIGHT_LANDLORD_EMAIL ||
  process.env.E2E_HOST_EMAIL ||
  process.env.E2E_LANDLORD_EMAIL ||
  "";
const LANDLORD_PASSWORD =
  process.env.PLAYWRIGHT_HOST_PASSWORD ||
  process.env.PLAYWRIGHT_LANDLORD_PASSWORD ||
  process.env.E2E_HOST_PASSWORD ||
  process.env.E2E_LANDLORD_PASSWORD ||
  "";
const AGENT_EMAIL = process.env.PLAYWRIGHT_AGENT_EMAIL || process.env.E2E_AGENT_EMAIL || "";
const AGENT_PASSWORD =
  process.env.PLAYWRIGHT_AGENT_PASSWORD || process.env.E2E_AGENT_PASSWORD || "";

const KNOWN_BENIGN_CONSOLE_PATTERNS: RegExp[] = [/Download the React DevTools/i];

function attachRuntimeErrorGuards(page: Page) {
  const runtimeErrors: string[] = [];

  page.on("console", (message) => {
    const text = message.text();
    if (KNOWN_BENIGN_CONSOLE_PATTERNS.some((pattern) => pattern.test(text))) {
      return;
    }
    if (
      message.type() === "error" ||
      /Unhandled|TypeError|ReferenceError/i.test(text)
    ) {
      runtimeErrors.push(`[console:${message.type()}] ${text}`);
    }
  });

  page.on("pageerror", (error) => {
    runtimeErrors.push(`[pageerror] ${error.message}`);
  });

  return runtimeErrors;
}

async function loginAsRole(page: Page, email: string, password: string) {
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page
    .getByRole("button", { name: /sign in|log in|continue/i })
    .first()
    .click();
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"), {
    timeout: 20_000,
  });
}

async function runHomeLandingSmoke(
  page: Page,
  options: {
    roleLabel: "landlord" | "agent";
    email: string;
    password: string;
  }
) {
  const runtimeErrors = attachRuntimeErrorGuards(page);

  await loginAsRole(page, options.email, options.password);
  await page.goto("/home", { waitUntil: "networkidle" });

  if (page.url().includes("/auth/login")) {
    test.skip(true, `${options.roleLabel} session could not be established.`);
  }

  await expect(page.getByTestId(smokeSelectors.homeVisualLanding)).toBeVisible();
  await expect(page.getByTestId(smokeSelectors.homeFeaturedStrip)).toBeVisible();
  await expect(page.locator('[data-testid^="host-featured-strip-card-"]').first()).toBeVisible();

  await page.getByRole("button", { name: /^Manage properties$/i }).first().click();
  await page.waitForURL("**/host/properties*", { timeout: 20_000 });
  await expect(page.getByTestId(smokeSelectors.hostPropertiesPage)).toBeVisible();

  const liveFilter = page.getByTestId(smokeSelectors.hostPropertiesFilterLive);
  await liveFilter.click();
  await expect(liveFilter).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId(smokeSelectors.hostPropertiesResults)).toBeVisible();

  expect(
    runtimeErrors,
    `${options.roleLabel} /home → /host/properties emitted runtime errors:\n${runtimeErrors.join("\n")}`
  ).toEqual([]);
}

test.describe("home landing smoke", () => {
  test("landlord sees listings-first home and can open manager", async ({ page }) => {
    test.skip(
      !LANDLORD_EMAIL || !LANDLORD_PASSWORD,
      "Landlord credentials not configured for smoke run."
    );

    await runHomeLandingSmoke(page, {
      roleLabel: "landlord",
      email: LANDLORD_EMAIL,
      password: LANDLORD_PASSWORD,
    });
  });

  test("agent sees listings-first home and can open manager", async ({ page }) => {
    test.skip(!AGENT_EMAIL || !AGENT_PASSWORD, "Agent credentials not configured for smoke run.");

    await runHomeLandingSmoke(page, {
      roleLabel: "agent",
      email: AGENT_EMAIL,
      password: AGENT_PASSWORD,
    });
  });
});
