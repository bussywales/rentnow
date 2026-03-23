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

async function openExploreLabsPage(page: Page) {
  await page.goto("/explore-labs", { waitUntil: "commit" });
  await expect(page.getByTestId(smokeSelectors.exploreLabsShell)).toBeVisible();
  await expect(page.getByTestId(smokeSelectors.exploreLabsPage)).toBeVisible();
  await expect(page.getByTestId(smokeSelectors.explorePager)).toBeVisible();
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
    await openExploreLabsPage(page);
    await expect(page.getByTestId(smokeSelectors.explorePagerLiteTrack)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.exploreSlide).first()).toBeVisible();

    const currentSlideLocator = page.locator(
      `[data-testid="${smokeSelectors.explorePagerLiteTrack}"] [data-slot="current"]`
    );
    const readCurrentSlideIndex = async () => {
      const indexText = await currentSlideLocator.getAttribute("data-slide-index");
      return Number(indexText ?? "-1");
    };
    const initialIndex = await readCurrentSlideIndex();
    const initialScrollY = await page.evaluate(() => window.scrollY);

    setStep("touch-vertical-swipe-from-gallery-layer");
    const swipeDispatched = await page.evaluate((galleryTestId) => {
      const target = document.querySelector<HTMLElement>(`[data-testid="${galleryTestId}"]`);
      if (!target) return false;
      const rect = target.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const x = rect.left + rect.width * 0.5;
      const startY = rect.top + rect.height * 0.65;
      const swipeDistance = Math.max(rect.height * 0.68, window.innerHeight * 0.34, 260);
      const moveSteps = [0.18, 0.42, 0.68, 1].map((ratio) => startY - swipeDistance * ratio);
      const dispatchTouch = (type: "touchstart" | "touchmove" | "touchend", y: number) => {
        const event = new Event(type, { bubbles: true, cancelable: true }) as Event & {
          touches: Array<{ clientX: number; clientY: number }>;
          targetTouches: Array<{ clientX: number; clientY: number }>;
          changedTouches: Array<{ clientX: number; clientY: number }>;
        };
        const point = { clientX: x, clientY: y };
        Object.defineProperty(event, "touches", {
          value: type === "touchend" ? [] : [point],
          configurable: true,
        });
        Object.defineProperty(event, "targetTouches", {
          value: type === "touchend" ? [] : [point],
          configurable: true,
        });
        Object.defineProperty(event, "changedTouches", {
          value: [point],
          configurable: true,
        });
        target.dispatchEvent(event);
      };
      dispatchTouch("touchstart", startY);
      for (const nextY of moveSteps) {
        dispatchTouch("touchmove", nextY);
      }
      dispatchTouch("touchend", moveSteps[moveSteps.length - 1] ?? startY);
      return true;
    }, "explore-gallery-gesture-layer");
    expect(swipeDispatched).toBeTruthy();
    await expect
      .poll(async () => readCurrentSlideIndex(), { timeout: 4000 })
      .toBeGreaterThan(initialIndex);
    await expect
      .poll(async () => page.evaluate(() => window.scrollY), { timeout: 1500 })
      .toBe(initialScrollY);

    expect(
      runtimeErrors,
      `explore labs smoke emitted runtime errors:\n${runtimeErrors.join("\n")}`
    ).toEqual([]);
  });

  test("explore-labs desktop wheel advances slides without runtime errors", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      isMobile: false,
      hasTouch: false,
    });
    const page = await context.newPage();
    let step = "init-desktop";
    const setStep = (value: string) => {
      step = value;
    };
    const runtimeErrors = attachRuntimeErrorGuards(page, () => step);

    const currentSlideLocator = page.locator(
      `[data-testid="${smokeSelectors.explorePagerLiteTrack}"] [data-slot="current"]`
    );
    const readCurrentSlideIndex = async () => {
      const indexText = await currentSlideLocator.getAttribute("data-slide-index");
      return Number(indexText ?? "-1");
    };

    setStep("open-explore-labs-desktop");
    await openExploreLabsPage(page);
    await expect(currentSlideLocator).toBeVisible();

    const initialIndex = await readCurrentSlideIndex();
    expect(initialIndex).toBeGreaterThanOrEqual(0);

    setStep("wheel-advance");
    const pager = page.getByTestId(smokeSelectors.explorePager);
    const pagerBox = await pager.boundingBox();
    expect(pagerBox).toBeTruthy();
    if (!pagerBox) {
      throw new Error("Expected explore pager bounding box to exist.");
    }
    await page.mouse.move(pagerBox.x + pagerBox.width * 0.5, pagerBox.y + 12);
    await pager.dispatchEvent("wheel", { deltaX: 0, deltaY: 420, bubbles: true, cancelable: true });
    await page.waitForTimeout(80);
    await pager.dispatchEvent("wheel", { deltaX: 0, deltaY: 420, bubbles: true, cancelable: true });

    await expect
      .poll(async () => readCurrentSlideIndex(), { timeout: 2000 })
      .toBeGreaterThan(initialIndex);

    expect(
      runtimeErrors,
      `explore labs desktop smoke emitted runtime errors:\n${runtimeErrors.join("\n")}`
    ).toEqual([]);
    await context.close();
  });
});
