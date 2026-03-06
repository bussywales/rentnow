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
    if (KNOWN_BENIGN_CONSOLE_PATTERNS.some((pattern) => pattern.test(text))) return;
    if (message.type() === "error" || /Unhandled|TypeError|ReferenceError/i.test(text)) {
      runtimeErrors.push(`[console:${message.type()}] ${text}`);
    }
  });
  page.on("pageerror", (error) => {
    const stack = error.stack ? `\n${error.stack}` : "";
    runtimeErrors.push(`[pageerror:${page.url()}] ${error.message}${stack}`);
  });
  return runtimeErrors;
}

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("explore-v2 feed renders and stays stable after native scroll", async ({ page }) => {
  const runtimeErrors = attachRuntimeErrorGuards(page);

  await page.goto("/explore-v2", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId(smokeSelectors.exploreV2Page)).toBeVisible();
  await expect(page.getByTestId(smokeSelectors.exploreV2Feed)).toBeVisible();
  await expect(page.getByTestId(smokeSelectors.exploreV2ChipRow)).toBeVisible();
  await expect(page.getByTestId(smokeSelectors.exploreV2HeaderSummary)).toContainText(/All types/i);

  await page.getByTestId(smokeSelectors.exploreV2ChipType).click();
  await expect(page.getByTestId(smokeSelectors.exploreV2FilterSheet)).toBeVisible();
  await page.getByTestId(smokeSelectors.exploreV2TypeOptionShortlets).click();
  await page.getByTestId(smokeSelectors.exploreV2SheetApply).click();
  await expect(page.getByTestId(smokeSelectors.exploreV2FilterSheet)).toHaveCount(0);
  await expect(page.getByTestId(smokeSelectors.exploreV2HeaderSummary)).toContainText(/Shortlets/i);

  await expect.poll(async () => page.getByTestId(smokeSelectors.exploreV2DockSafeZone).count()).toBeGreaterThan(0);
  await expect.poll(async () => page.getByTestId(smokeSelectors.exploreV2Card).count()).toBeGreaterThan(0);
  await expect
    .poll(async () => page.getByTestId(smokeSelectors.exploreV2HeroCarousel).count())
    .toBeGreaterThan(0);
  await expect
    .poll(async () => page.getByTestId(smokeSelectors.exploreV2HeroHasImage).count())
    .toBeGreaterThan(0);
  await expect
    .poll(async () => page.getByTestId(smokeSelectors.exploreV2ActionRail).count())
    .toBeGreaterThan(0);
  const heroViewport = page.getByTestId(smokeSelectors.exploreV2HeroCarouselViewport).first();
  await expect(heroViewport).toBeVisible();
  await expect(heroViewport).toHaveAttribute("style", /touch-action:\s*pan-y pinch-zoom/i);
  const heroViewportClassName = (await heroViewport.getAttribute("class")) ?? "";
  expect(heroViewportClassName).toContain("overflow-hidden");
  expect(heroViewportClassName).not.toContain("overflow-x-scroll");

  const firstSaveToggle = page.locator('[data-testid^="explore-v2-save-toggle-"]').first();
  const firstSaveSurface = page.getByTestId("explore-v2-save-surface").first();
  await expect(firstSaveToggle).toBeVisible();
  await expect(firstSaveSurface).toBeVisible();
  const previousSaved = (await firstSaveToggle.getAttribute("aria-pressed")) === "true";
  await firstSaveSurface.click();
  const saveAuthSheet = page.getByTestId(smokeSelectors.exploreV2SaveAuthSheet);
  const saveAuthPromptVisible = await saveAuthSheet
    .isVisible()
    .catch(() => false);
  if (saveAuthPromptVisible) {
    await page.getByTestId(smokeSelectors.exploreV2SaveAuthNotNow).click();
    await expect(saveAuthSheet).toHaveCount(0);
  } else {
    await expect(firstSaveToggle).toHaveAttribute("aria-pressed", previousSaved ? "false" : "true");
    await expect(page.getByTestId(smokeSelectors.exploreV2GlassToast)).toContainText(/Saved|Removed/i);
  }

  await page.getByTestId(smokeSelectors.exploreV2ShareAction).first().click();
  await expect(page.getByTestId(smokeSelectors.exploreV2GlassToast)).toContainText(
    /Shared|Link copied|Copy failed/i
  );

  await page.getByTestId(smokeSelectors.exploreV2CtaAction).first().click();
  await expect(page.getByTestId(smokeSelectors.exploreV2CtaSheet)).toBeVisible();
  await expect(page.getByTestId(smokeSelectors.exploreV2CtaViewDetails)).toBeVisible();
  await expect(page.getByTestId(smokeSelectors.exploreV2CtaShareAction)).toBeVisible();
  await page.getByTestId(smokeSelectors.exploreV2CtaClose).click();
  await expect(page.getByTestId(smokeSelectors.exploreV2CtaSheet)).toHaveCount(0);

  const countPillCount = await page.getByTestId(smokeSelectors.exploreV2HeroCarouselCountBadge).count();
  if (countPillCount > 0) {
    await expect(page.getByTestId(smokeSelectors.exploreV2HeroCarouselCountBadge).first()).toContainText(
      /\d+\/\d+/
    );
  }

  const videoBadge = page.getByTestId(smokeSelectors.exploreV2VideoBadge).first();
  const hasVideoBadge = await videoBadge.isVisible().catch(() => false);
  if (hasVideoBadge) {
    await expect(videoBadge).toContainText(/Video tour/i);
    const href = await videoBadge.getAttribute("href");
    expect(href ?? "").toMatch(/\/properties\/.+media=video/i);
  }

  await page.evaluate(() => window.scrollBy(0, 900));
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect.poll(async () => page.getByTestId(smokeSelectors.exploreV2Card).count()).toBeGreaterThan(0);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByTestId(smokeSelectors.exploreV2CtaAction).first().click();
  await expect(page.getByTestId(smokeSelectors.exploreV2CtaSheet)).toBeVisible();
  await page.getByTestId(smokeSelectors.exploreV2CtaViewDetails).click();
  await expect(page).toHaveURL(/\/properties\/.+source=explore_v0/i);

  expect(
    runtimeErrors,
    `explore-v2 smoke emitted runtime errors:\n${runtimeErrors.join("\n")}`
  ).toEqual([]);
});
