import { expect, test, type Page } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";

const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL || process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD =
  process.env.PLAYWRIGHT_ADMIN_PASSWORD || process.env.E2E_ADMIN_PASSWORD || "";
const KNOWN_BENIGN_CONSOLE_PATTERNS: RegExp[] = [/Download the React DevTools/i];

const FIXTURE_REQUEST = {
  id: "req_smoke_support_001",
  createdAt: "2026-02-23T10:30:00.000Z",
  category: "billing",
  email: "smoke+support@propatyhub.test",
  name: "Smoke Tenant",
  status: "new",
  role: "tenant",
  message: "Charged but booking confirmation did not show in trips.",
  excerpt: "Charged but booking confirmation did not show in trips.",
  escalated: true,
  metadata: {
    escalationReason: "smoke_test_escalation",
    pageUrl: "https://www.propatyhub.com/shortlets",
  },
  transcript: [
    { role: "user", content: "How do booking requests work?" },
    {
      role: "assistant",
      content: "Hosts review request bookings within 12 hours. We can escalate now.",
    },
  ],
};

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

test.describe("admin support inbox smoke", () => {
  test("admin can refresh support inbox and open request details drawer", async ({ page }) => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD,
      "Admin credentials not configured for smoke run."
    );

    const runtimeErrors = attachRuntimeErrorGuards(page);

    await page.route("**/api/admin/support/requests**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          items: [FIXTURE_REQUEST],
          pagination: { total: 1, hasMore: false },
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

    const refreshResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes("/api/admin/support/requests") &&
        response.status() === 200,
      { timeout: 20_000 }
    );
    await page.getByTestId(smokeSelectors.adminSupportRefresh).click();
    await refreshResponse;

    const firstRow = page.getByTestId(smokeSelectors.adminSupportRow).first();
    await firstRow.getByRole("button", { name: /view/i }).click();

    const drawer = page.getByTestId(smokeSelectors.adminSupportDrawer);
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText(/Metadata/i);
    await expect(drawer).toContainText(/AI transcript/i);
    await expect(drawer).toContainText(/charged but booking confirmation/i);

    expect(
      runtimeErrors,
      `admin support inbox flow emitted runtime errors:\n${runtimeErrors.join("\n")}`
    ).toEqual([]);
  });
});

