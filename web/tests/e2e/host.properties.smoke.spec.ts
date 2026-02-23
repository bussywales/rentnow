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

async function runHostPropertiesSmoke(
  page: Page,
  options: {
    roleLabel: "landlord" | "agent";
    email: string;
    password: string;
  }
) {
  const runtimeErrors = attachRuntimeErrorGuards(page);

  await loginAsRole(page, options.email, options.password);
  await page.goto("/host/properties", { waitUntil: "networkidle" });

  if (page.url().includes("/auth/login")) {
    test.skip(true, `${options.roleLabel} session could not be established.`);
  }

  await expect(page.getByTestId(smokeSelectors.hostPropertiesPage)).toBeVisible();
  await expect(page.getByTestId(smokeSelectors.hostPropertiesManager)).toBeVisible();
  await expect(page.getByTestId(smokeSelectors.hostPropertiesResults)).toBeVisible();

  const liveFilter = page.getByTestId(smokeSelectors.hostPropertiesFilterLive);
  await liveFilter.click();
  await expect(liveFilter).toHaveAttribute("aria-pressed", "true");

  const anyRow = page.locator('[data-testid^="host-properties-row-"]').first();
  const emptyState = page.getByText(/No listings match your current filters/i).first();
  await expect(anyRow.or(emptyState)).toBeVisible();

  expect(
    runtimeErrors,
    `${options.roleLabel} /host/properties emitted runtime errors:\n${runtimeErrors.join("\n")}`
  ).toEqual([]);
}

test.describe("host properties manager smoke", () => {
  test("landlord can open manager and apply live filter", async ({ page }) => {
    test.skip(
      !LANDLORD_EMAIL || !LANDLORD_PASSWORD,
      "Landlord credentials not configured for smoke run."
    );

    await runHostPropertiesSmoke(page, {
      roleLabel: "landlord",
      email: LANDLORD_EMAIL,
      password: LANDLORD_PASSWORD,
    });
  });

  test("agent can open manager and apply live filter", async ({ page }) => {
    test.skip(!AGENT_EMAIL || !AGENT_PASSWORD, "Agent credentials not configured for smoke run.");

    await runHostPropertiesSmoke(page, {
      roleLabel: "agent",
      email: AGENT_EMAIL,
      password: AGENT_PASSWORD,
    });
  });
});
