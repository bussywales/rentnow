import { expect, test, type Page } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";

const KNOWN_BENIGN_CONSOLE_PATTERNS: RegExp[] = [
  /Download the React DevTools/i,
  /Failed to load resource: the server responded with a status of 401 \(Unauthorized\)/i,
];
const GO_LIVE_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

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

test.describe("saved mobile smoke", () => {
  test("save from home and clear from saved page", async ({ page }) => {
    const runtimeErrors = attachRuntimeErrorGuards(page);
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
    await dismissDisclaimerIfPresent();
    await page.evaluate(() => {
      const payload = {
        version: 1,
        items: [
          {
            id: "seeded-saved-property",
            kind: "property",
            marketCountry: "GB",
            href: "/properties?intent=rent",
            title: "Seeded saved property",
            subtitle: "Saved smoke fixture",
            tag: "For sale",
            savedAt: new Date().toISOString(),
          },
        ],
      };
      localStorage.setItem("ph:saved:v0", JSON.stringify(payload));
      window.dispatchEvent(new Event("ph:saved:v0:changed"));
    });

    await page.goto("/saved", { waitUntil: "domcontentloaded" });
    await dismissDisclaimerIfPresent();
    await expect(page.getByTestId(smokeSelectors.savedPage)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.savedItemRow).first()).toBeVisible();

    await page.getByTestId(smokeSelectors.savedClearAll).click({ force: true });
    await page.getByTestId(smokeSelectors.savedClearAllConfirm).click({ force: true });
    await expect(page.getByTestId(smokeSelectors.savedEmptyState)).toBeVisible();

    expect(
      runtimeErrors,
      `saved mobile smoke emitted runtime errors:\n${runtimeErrors.join("\n")}`
    ).toEqual([]);
  });
});
