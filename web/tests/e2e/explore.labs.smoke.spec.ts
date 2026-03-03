import { expect, test, type Page } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";

const KNOWN_BENIGN_CONSOLE_PATTERNS: RegExp[] = [
  /Download the React DevTools/i,
  /Failed to load resource: the server responded with a status of 401 \(Unauthorized\)/i,
];
const KNOWN_BENIGN_PAGEERROR_PATTERNS: RegExp[] = [/Minified React error #418/i];

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
    if (KNOWN_BENIGN_PAGEERROR_PATTERNS.some((pattern) => pattern.test(error.message))) {
      return;
    }
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

test.describe("explore labs smoke", () => {
  test("explore kill-switch route and explore-labs route render safely", async ({ page }) => {
    let step = "init";
    const setStep = (value: string) => {
      step = value;
    };
    const runtimeErrors = attachRuntimeErrorGuards(page, () => step);

    setStep("open-explore");
    await page.goto("/explore", { waitUntil: "domcontentloaded" });
    const disabledScreen = page.getByTestId(smokeSelectors.exploreDisabledScreen);
    if (await disabledScreen.isVisible().catch(() => false)) {
      await expect(disabledScreen).toBeVisible();
      setStep("verify-home-chip-hidden-when-disabled");
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId(smokeSelectors.homeMobileQuickStart)).toBeVisible();
      await expect(page.getByTestId(smokeSelectors.homeMobileQuickStartExplore)).toHaveCount(0);
    } else {
      await expect(page.getByTestId(smokeSelectors.explorePage)).toBeVisible();
      await expect(page.getByTestId(smokeSelectors.explorePager)).toBeVisible();
    }

    setStep("open-explore-labs");
    await page.goto("/explore-labs", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(smokeSelectors.exploreLabsPage)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.explorePager)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.explorePagerLiteTrack)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.exploreSlide).first()).toBeVisible();

    expect(
      runtimeErrors,
      `explore labs smoke emitted runtime errors:\n${runtimeErrors.join("\n")}`
    ).toEqual([]);
  });
});
