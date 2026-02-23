import { test, expect, type Page } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";

const ADMIN_EMAIL =
  process.env.PLAYWRIGHT_ADMIN_EMAIL || process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD =
  process.env.PLAYWRIGHT_ADMIN_PASSWORD || process.env.E2E_ADMIN_PASSWORD || "";
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

test.describe("admin shortlets ops smoke", () => {
  test("renders ops page and refresh calls ops API", async ({ page }) => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD,
      "Admin credentials not configured for smoke run."
    );

    const runtimeErrors = attachRuntimeErrorGuards(page);

    await loginAsAdmin(page);
    const response = await page.goto("/admin/shortlets/ops", {
      waitUntil: "networkidle",
    });

    if (page.url().includes("/auth/login")) {
      test.skip(true, "Admin session could not be established.");
    }
    expect(response?.status(), "admin ops route should not 404").not.toBe(404);

    await expect(page.getByRole("heading", { name: /shortlets ops/i })).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.adminShortletsOpsRoot)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.adminShortletsOpsMetrics)).toBeVisible();
    await expect(page.getByText(/Last run:/i).first()).toBeVisible();

    const refreshResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes("/api/admin/shortlets/ops") &&
        response.status() === 200,
      { timeout: 20_000 }
    );

    await page.getByTestId(smokeSelectors.adminShortletsOpsRefresh).click();
    await refreshResponse;

    await expect(page.getByText(/Last run:/i).first()).toBeVisible();

    expect(
      runtimeErrors,
      `admin /admin/shortlets/ops emitted runtime errors:\n${runtimeErrors.join("\n")}`
    ).toEqual([]);
  });
});
