import { test, expect, type Page } from "@playwright/test";
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

function parseCount(value: string | null): number | null {
  if (!value) return null;
  const digitsOnly = value.replace(/[^\d]/g, "");
  if (!digitsOnly) return null;
  const parsed = Number.parseInt(digitsOnly, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function runHostLeadsSmoke(
  page: Page,
  options: {
    roleLabel: "landlord" | "agent";
    email: string;
    password: string;
  }
) {
  const runtimeErrors = attachRuntimeErrorGuards(page);

  await loginAsRole(page, options.email, options.password);
  await page.goto("/host/leads", { waitUntil: "networkidle" });

  if (page.url().includes("/auth/login")) {
    test.skip(true, `${options.roleLabel} session could not be established.`);
  }

  const pageRoot = page
    .getByTestId(smokeSelectors.hostLeadsPage)
    .or(page.getByRole("heading", { name: /^Leads$/i }));
  await expect(pageRoot.first()).toBeVisible();

  const filterRoot = page
    .getByTestId(smokeSelectors.hostLeadsFilters)
    .or(page.getByTestId("lead-tab-all"));
  await expect(filterRoot.first()).toBeVisible();

  const rows = page.locator('[data-testid^="lead-row-"]');
  const emptyState = page.getByText(/No new enquiries yet|No leads match this view/i).first();
  await expect(rows.first().or(emptyState)).toBeVisible();

  const initialRowCount = await rows.count();
  test.skip(initialRowCount < 1, `No leads available for ${options.roleLabel} smoke assertions.`);

  const allTabCount = parseCount(await page.getByTestId("lead-tab-count-all").textContent());
  const candidateTabs: Array<"new" | "contacted" | "viewing" | "won" | "lost"> = [
    "new",
    "contacted",
    "viewing",
    "won",
    "lost",
  ];

  let selectedTab: (typeof candidateTabs)[number] | null = null;
  let selectedTabCount: number | null = null;
  for (const tabKey of candidateTabs) {
    const tabCount = parseCount(await page.getByTestId(`lead-tab-count-${tabKey}`).textContent());
    if (tabCount !== null && allTabCount !== null && tabCount !== allTabCount) {
      selectedTab = tabKey;
      selectedTabCount = tabCount;
      break;
    }
  }

  test.skip(
    !selectedTab,
    `No alternate lead tab counts available for deterministic ${options.roleLabel} filter assertion.`
  );

  await page.getByTestId(`lead-tab-${selectedTab}`).click();
  await expect(page.getByTestId(`lead-tab-${selectedTab}`)).toHaveClass(/bg-slate-900/);
  await expect
    .poll(async () => rows.count(), { timeout: 10_000 })
    .toBe(selectedTabCount as number);

  expect(
    runtimeErrors,
    `${options.roleLabel} /host/leads emitted runtime errors:\n${runtimeErrors.join("\n")}`
  ).toEqual([]);
}

test.describe("host leads smoke", () => {
  test("landlord can load host leads and apply a filter", async ({ page }) => {
    test.skip(
      !LANDLORD_EMAIL || !LANDLORD_PASSWORD,
      "Landlord credentials not configured for smoke run."
    );

    await runHostLeadsSmoke(page, {
      roleLabel: "landlord",
      email: LANDLORD_EMAIL,
      password: LANDLORD_PASSWORD,
    });
  });

  test("agent can load host leads and apply a filter", async ({ page }) => {
    test.skip(!AGENT_EMAIL || !AGENT_PASSWORD, "Agent credentials not configured for smoke run.");

    await runHostLeadsSmoke(page, {
      roleLabel: "agent",
      email: AGENT_EMAIL,
      password: AGENT_PASSWORD,
    });
  });
});

