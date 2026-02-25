import { expect, test, type Page } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";

const KNOWN_BENIGN_CONSOLE_PATTERNS: RegExp[] = [
  /Download the React DevTools/i,
  /Failed to load resource: the server responded with a status of 401 \(Unauthorized\)/i,
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

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test.describe("collections mobile smoke", () => {
  test("collection page renders and routes into results", async ({ page }) => {
    const runtimeErrors = attachRuntimeErrorGuards(page);
    await page.goto("/collections/weekend-getaways", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId(smokeSelectors.collectionsHero)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.collectionsRail)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.collectionsCard).first()).toBeVisible();

    await page.getByTestId(smokeSelectors.collectionsViewResultsCta).click();
    await page.waitForURL(/\/shortlets(\?|$)/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /find shortlets/i })).toBeVisible();

    expect(
      runtimeErrors,
      `collections mobile smoke emitted runtime errors:\n${runtimeErrors.join("\n")}`
    ).toEqual([]);
  });
});

