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

test.describe("home mobile featured discovery smoke", () => {
  test("featured cards route with market-aware destinations", async ({ page }) => {
    const runtimeErrors = attachRuntimeErrorGuards(page);

    const dismissDisclaimerIfPresent = async () => {
      const dismissDisclaimer = page.getByRole("button", { name: /Dismiss marketplace disclaimer/i });
      if (await dismissDisclaimer.isVisible().catch(() => false)) {
        await dismissDisclaimer.click({ force: true });
      }
    };

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await dismissDisclaimerIfPresent();

    await expect(page.getByTestId(smokeSelectors.homeMobileFeaturedStrip)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.homeMobileFeaturedScroll)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.homeMobileFeaturedItem).first()).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.homeMobileFeaturedStrip)).toHaveAttribute(
      "data-market-country",
      /[A-Z]{2}/
    );

    const menuButton = page.getByTestId(smokeSelectors.hamburgerMenu);
    if (!(await menuButton.isVisible().catch(() => false))) {
      test.skip(true, "Mobile hamburger menu is not visible for market switch flow.");
    }
    await menuButton.click();
    await expect(page.getByTestId(smokeSelectors.mobileDrawerPanel)).toBeVisible();

    const marketSelect = page.getByTestId(smokeSelectors.mobileDrawerPanel).getByLabel("Select market");
    if (!(await marketSelect.isVisible().catch(() => false))) {
      test.skip(true, "Market selector is disabled in this environment.");
    }
    const currentValue = await marketSelect.inputValue();
    const target =
      currentValue === "CA|CAD"
        ? { value: "US|USD", country: "US", label: "United States" }
        : { value: "CA|CAD", country: "CA", label: "Canada" };
    await marketSelect.selectOption(target.value);
    await page.getByTestId(smokeSelectors.mobileDrawerClose).click();

    await expect(page.getByTestId(smokeSelectors.marketSwitchToast)).toContainText(
      `Now showing picks for ${target.label}`
    );
    await expect(page.getByTestId(smokeSelectors.homeMobileFeaturedStrip)).toHaveAttribute(
      "data-market-country",
      target.country
    );

    const firstFeaturedLink = page.locator('[data-testid^="mobile-featured-item-"]').first();
    await firstFeaturedLink.click({ force: true });
    await page.waitForURL(/\/(shortlets|properties)(\?|$)/, { timeout: 20_000 });

    const finalUrl = new URL(page.url());
    expect(["/shortlets", "/properties"]).toContain(finalUrl.pathname);
    const decodedSearch = decodeURIComponent(finalUrl.search).toLowerCase();
    expect(decodedSearch).not.toContain("lagos");
    expect(decodedSearch).not.toContain("abuja");
    expect(decodedSearch).not.toContain("port harcourt");
    expect(decodedSearch).not.toContain("ibadan");
    expect(decodedSearch).not.toContain("enugu");

    if (finalUrl.pathname === "/shortlets") {
      await expect(page.getByRole("heading", { name: /find shortlets/i })).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name: /properties/i })).toBeVisible();
    }

    await page.goto("/shortlets", { waitUntil: "domcontentloaded" });
    await dismissDisclaimerIfPresent();
    await expect(page.getByTestId(smokeSelectors.shortletsFeaturedRail)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.shortletsFeaturedRail)).toHaveAttribute(
      "data-market-country",
      target.country
    );

    await page.goto("/properties", { waitUntil: "domcontentloaded" });
    await dismissDisclaimerIfPresent();
    await expect(page.getByTestId(smokeSelectors.propertiesFeaturedRail)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.propertiesFeaturedRail)).toHaveAttribute(
      "data-market-country",
      target.country
    );

    expect(
      runtimeErrors,
      `home mobile featured discovery smoke emitted runtime errors:\n${runtimeErrors.join("\n")}`
    ).toEqual([]);
  });
});
