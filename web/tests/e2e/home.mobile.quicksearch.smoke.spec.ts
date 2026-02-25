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

test.describe("home mobile quick search smoke", () => {
  test("category and preset flows route to correct destinations", async ({ page }) => {
    const runtimeErrors = attachRuntimeErrorGuards(page);
    const dismissDisclaimerIfPresent = async () => {
      const dismissDisclaimer = page.getByRole("button", { name: /Dismiss marketplace disclaimer/i });
      if (await dismissDisclaimer.isVisible().catch(() => false)) {
        await dismissDisclaimer.click({ force: true });
      }
    };

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissDisclaimerIfPresent();
    await expect(page.getByTestId(smokeSelectors.homeMobileQuickStart)).toBeVisible();

    await page.getByTestId(smokeSelectors.homeMobileQuickSearchTrigger).click();
    await expect(page.getByTestId(smokeSelectors.homeMobileQuickSearchSheet)).toBeVisible();
    await page.getByTestId(smokeSelectors.homeMobileQuickSearchCategoryShortlet).click();
    const locationInput = page.getByTestId(smokeSelectors.homeMobileQuickSearchLocation);
    await locationInput.fill("Lekki");
    await locationInput.press("Enter");

    await page.waitForURL(/\/shortlets(\?|$)/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /find shortlets/i })).toBeVisible();

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissDisclaimerIfPresent();
    await expect(page.getByTestId(smokeSelectors.homeMobileQuickStart)).toBeVisible();
    await page.getByTestId(smokeSelectors.homeMobileQuickSearchTrigger).click();
    await expect(page.getByTestId(smokeSelectors.homeMobileQuickSearchSheet)).toBeVisible();
    await page.getByTestId(smokeSelectors.homeMobileQuickSearchCategoryRent).click();
    await page.getByTestId(smokeSelectors.homeMobileQuickSearchPresetRentLagos).click();
    const rentLocationInput = page.getByTestId(smokeSelectors.homeMobileQuickSearchLocation);
    await rentLocationInput.focus();
    await rentLocationInput.press("Enter");

    await page.waitForURL(/\/properties(\?|$)/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /properties/i })).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.propertiesFeaturedRail)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.propertiesFeaturedItem).first()).toBeVisible();

    const finalUrl = new URL(page.url());
    expect(finalUrl.pathname).toBe("/properties");
    expect(finalUrl.searchParams.get("intent")).toBe("rent");

    expect(
      runtimeErrors,
      `home mobile quick search smoke emitted runtime errors:\n${runtimeErrors.join("\n")}`
    ).toEqual([]);
  });
});
