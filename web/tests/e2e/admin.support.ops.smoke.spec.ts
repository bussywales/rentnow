import { expect, test, type Page } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD =
  process.env.PLAYWRIGHT_ADMIN_PASSWORD || process.env.E2E_ADMIN_PASSWORD || "";
const KNOWN_BENIGN_CONSOLE_PATTERNS: RegExp[] = [/Download the React DevTools/i];

const FIXTURE_ITEMS = [
  {
    id: "req_smoke_ops_001",
    createdAt: "2026-02-24T10:30:00.000Z",
    category: "billing",
    email: "ops+support@propatyhub.test",
    name: "Ops Tenant",
    status: "new",
    role: "tenant",
    message: "Charged but booking confirmation did not show in trips.",
    excerpt: "Charged but booking confirmation did not show in trips.",
    escalated: true,
    metadata: {
      escalationReason: "smoke_test_escalation",
      pageUrl: "https://www.propatyhub.com/shortlets",
    },
    transcript: [{ role: "user", content: "How do booking requests work?" }],
    claimedBy: null,
    claimedAt: null,
    resolvedAt: null,
  },
];

function attachRuntimeErrorGuards(page: Page) {
  const runtimeErrors: string[] = [];

  page.on("console", (message) => {
    const text = message.text();
    if (KNOWN_BENIGN_CONSOLE_PATTERNS.some((pattern) => pattern.test(text))) {
      return;
    }
    if (message.type() === "error" || /Unhandled|TypeError|ReferenceError/i.test(text)) {
      runtimeErrors.push(`[console:${message.type()}] ${text}`);
    }
  });

  page.on("pageerror", (error) => {
    runtimeErrors.push(`[pageerror] ${error.message}`);
  });

  return runtimeErrors;
}

async function loginAsAdmin(page: Page) {
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).first().fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).first().fill(ADMIN_PASSWORD);
  await page
    .getByRole("button", { name: /sign in|log in|continue/i })
    .first()
    .click();
  await page.waitForURL((url) => !url.pathname.includes("/auth/login"), {
    timeout: 20_000,
  });
}

test.describe("admin support ops smoke", () => {
  test("admin can filter and inspect support inbox without console errors", async ({ page }) => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD,
      "Admin credentials not configured for smoke run."
    );

    const runtimeErrors = attachRuntimeErrorGuards(page);

    await page.route("**/api/admin/support/requests**", async (route) => {
      const url = new URL(route.request().url());
      const status = url.searchParams.get("status") || "open";
      const items =
        status === "resolved"
          ? [{ ...FIXTURE_ITEMS[0], id: "req_smoke_ops_002", status: "resolved", resolvedAt: "2026-02-24T11:00:00.000Z" }]
          : FIXTURE_ITEMS;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          items,
          pagination: { total: items.length, hasMore: false },
        }),
      });
    });

    await loginAsAdmin(page);
    await page.goto("/admin/support", { waitUntil: "networkidle" });

    if (page.url().includes("/auth/login")) {
      test.skip(true, "Admin session could not be established.");
    }

    await expect(page.getByTestId(smokeSelectors.adminSupportTable)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.adminSupportRow)).toBeVisible();

    const filterResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes("/api/admin/support/requests") &&
        response.url().includes("status=all") &&
        response.status() === 200,
      { timeout: 20_000 }
    );
    await page.getByTestId(smokeSelectors.adminSupportStatusFilter).selectOption("all");
    await filterResponse;

    const firstRow = page.getByTestId(smokeSelectors.adminSupportRow).first();
    await firstRow.getByRole("button", { name: /view/i }).click();

    const drawer = page.getByTestId(smokeSelectors.adminSupportDrawer);
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText(/Metadata/i);
    await expect(drawer).toContainText(/AI transcript/i);

    expect(
      runtimeErrors,
      `admin support ops flow emitted runtime errors:\n${runtimeErrors.join("\n")}`
    ).toEqual([]);
  });

  test("admin discovery diagnostics page renders with summary sections", async ({ page }) => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD,
      "Admin credentials not configured for smoke run."
    );

    const runtimeErrors = attachRuntimeErrorGuards(page);

    await loginAsAdmin(page);
    await page.goto("/admin/discovery", { waitUntil: "domcontentloaded" });

    if (page.url().includes("/auth/login")) {
      test.skip(true, "Admin session could not be established.");
    }

    await expect(page.getByTestId(smokeSelectors.adminDiscoveryHealth)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.adminDiscoverySummary)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.adminDiscoveryTotalCount)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.adminDiscoveryMarketBreakdown)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.adminDiscoverySurfaceBreakdown)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.adminDiscoveryCoveragePanel)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.adminDiscoveryTopRisks)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.adminDiscoveryBrokenRoutes)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.adminDiscoveryExportCoverage)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.adminDiscoveryExportInvalid)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.adminDiscoveryExportBroken)).toBeVisible();

    await page.getByTestId(smokeSelectors.adminDiscoveryExportCoverage).click();

    expect(
      runtimeErrors,
      `admin discovery flow emitted runtime errors:\n${runtimeErrors.join("\n")}`
    ).toEqual([]);
  });

  test("admin settings page supports section search and navigation", async ({ page }) => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD,
      "Admin credentials not configured for smoke run."
    );

    const runtimeErrors = attachRuntimeErrorGuards(page);

    await loginAsAdmin(page);
    await page.goto("/admin/settings", { waitUntil: "domcontentloaded" });

    if (page.url().includes("/auth/login")) {
      test.skip(true, "Admin session could not be established.");
    }

    await expect(page.getByTestId(smokeSelectors.adminSettingsPage)).toBeVisible();
    const search = page.getByTestId(smokeSelectors.adminSettingsSearch);
    await expect(search).toBeVisible();

    await search.fill("explore");
    await expect(
      page.getByTestId(smokeSelectors.adminSettingsGroupFeatureToggles)
    ).toBeVisible();
    await expect(
      page.getByTestId(smokeSelectors.adminSettingsGroupListingExpiry)
    ).toHaveCount(0);

    const exploreToggleButton = page
      .getByTestId("admin-setting-explore_enabled")
      .getByRole("button", { name: /enable|disable/i })
      .first();
    await expect(exploreToggleButton).toBeVisible();
    await exploreToggleButton.click({ trial: true });

    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(search).toHaveValue("");

    await page
      .getByTestId(smokeSelectors.adminSettingsSidebarLinkListingExpiry)
      .first()
      .click();
    await expect(
      page.getByTestId(smokeSelectors.adminSettingsGroupListingExpiry)
    ).toBeVisible();

    expect(
      runtimeErrors,
      `admin settings flow emitted runtime errors:\n${runtimeErrors.join("\n")}`
    ).toEqual([]);
  });
});
