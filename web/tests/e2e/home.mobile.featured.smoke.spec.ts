import { expect, test, type Page } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";

const KNOWN_BENIGN_CONSOLE_PATTERNS: RegExp[] = [
  /Download the React DevTools/i,
  /Failed to load resource: the server responded with a status of 401 \(Unauthorized\)/i,
];
const GO_LIVE_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

function attachRuntimeErrorGuards(page: Page, getStep: () => string) {
  const runtimeErrors: string[] = [];

  page.on("console", (message) => {
    const text = message.text();
    if (KNOWN_BENIGN_CONSOLE_PATTERNS.some((pattern) => pattern.test(text))) {
      return;
    }
    if (message.type() === "error" || /Unhandled|TypeError|ReferenceError/i.test(text)) {
      runtimeErrors.push(`[console:${message.type()}][step:${getStep()}] ${text}`);
    }
  });

  page.on("pageerror", (error) => {
    const stack = error.stack ? `\n${error.stack}` : "";
    runtimeErrors.push(`[pageerror:${page.url()}][step:${getStep()}] ${error.message}${stack}`);
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
    let step = "init";
    const markStep = (next: string) => {
      step = next;
    };
    const runtimeErrors = attachRuntimeErrorGuards(page, () => step);
    await page.context().addCookies([
      {
        name: "ph_market",
        value: encodeURIComponent("GB|GBP"),
        url: GO_LIVE_BASE_URL,
      },
    ]);

    const dismissDisclaimerIfPresent = async () => {
      const dismissDisclaimer = page.getByRole("button", { name: /Dismiss marketplace disclaimer/i });
      if (await dismissDisclaimer.isVisible().catch(() => false)) {
        await dismissDisclaimer.click({ force: true });
      }
    };

    await page.goto("/", { waitUntil: "domcontentloaded" });
    markStep("home-loaded");
    await dismissDisclaimerIfPresent();

    const featuredStrip = page.getByTestId(smokeSelectors.homeMobileFeaturedStrip);
    await expect(featuredStrip).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.homeMobileFeaturedScroll)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.homeMobileFeaturedItem).first()).toBeVisible();
    await expect(featuredStrip.getByTestId(smokeSelectors.trustBadges).first()).toBeVisible();
    await expect(featuredStrip.getByTestId(smokeSelectors.trustMarketPicks).first()).toContainText("Picks for");
    const firstSaveToggle = page.locator('[data-testid^="save-toggle-"]').first();
    await expect(firstSaveToggle).toBeVisible();
    markStep("save-toggle-first-featured");
    await firstSaveToggle.click({ force: true });
    await expect(page.getByTestId(smokeSelectors.homeMobileSavedRail)).toBeVisible();

    const menuButton = page.getByTestId(smokeSelectors.hamburgerMenu);
    if (!(await menuButton.isVisible().catch(() => false))) {
      test.skip(true, "Mobile hamburger menu is not visible for market switch flow.");
    }
    markStep("open-mobile-menu");
    await menuButton.click();
    await expect(page.getByTestId(smokeSelectors.mobileDrawerPanel)).toBeVisible();

    const marketSelect = page.getByTestId(smokeSelectors.mobileDrawerPanel).getByLabel("Select market");
    if (!(await marketSelect.isVisible().catch(() => false))) {
      test.skip(true, "Market selector is disabled in this environment.");
    }
    const currentValue = await marketSelect.inputValue();
    const target =
      currentValue === "GB|GBP"
        ? { value: "US|USD", country: "US", label: "United States" }
        : { value: "GB|GBP", country: "GB", label: "United Kingdom" };
    markStep("switch-market");
    await marketSelect.selectOption(target.value);
    await page.getByTestId(smokeSelectors.mobileDrawerClose).click();

    await expect(page.getByTestId(smokeSelectors.marketSwitchToast)).toContainText(
      `Now showing picks for ${target.label}`
    );
    await expect
      .poll(async () => page.getByTestId(smokeSelectors.homeMobileFeaturedStrip).getAttribute("data-market-country"))
      .toBe(target.country);

    const firstFeaturedLink = featuredStrip.locator('[data-testid^="mobile-featured-item-"]').first();
    markStep("click-first-featured-link");
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

    await page.goto("/shortlets", { waitUntil: "networkidle" });
    markStep("verify-shortlets-rail");
    await dismissDisclaimerIfPresent();
    await expect(page.getByTestId(smokeSelectors.shortletsFeaturedRail)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.shortletsFeaturedRail)).toHaveAttribute(
      "data-market-country",
      target.country
    );

    await page.goto("/properties", { waitUntil: "networkidle" });
    markStep("verify-properties-rail");
    await dismissDisclaimerIfPresent();
    await expect(page.getByTestId(smokeSelectors.propertiesFeaturedRail)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.propertiesFeaturedRail)).toHaveAttribute(
      "data-market-country",
      target.country
    );

    await page.goto("/", { waitUntil: "networkidle" });
    markStep("verify-recently-viewed");
    await dismissDisclaimerIfPresent();
    await expect(page.getByTestId(smokeSelectors.homeMobileRecentlyViewedRail)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.homeMobileRecentlyViewedItem).first()).toBeVisible();

    expect(
      runtimeErrors,
      `home mobile featured discovery smoke emitted runtime errors:\n${runtimeErrors.join("\n")}`
    ).toEqual([]);
  });
});
