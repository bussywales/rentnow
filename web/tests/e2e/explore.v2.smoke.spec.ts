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
  await expect.poll(async () => page.getByTestId(smokeSelectors.exploreV2Card).count()).toBeGreaterThan(0);
  await expect
    .poll(async () => page.getByTestId(smokeSelectors.exploreV2HeroHasImage).count())
    .toBeGreaterThan(0);

  await page.evaluate(() => window.scrollBy(0, 900));
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect.poll(async () => page.getByTestId(smokeSelectors.exploreV2Card).count()).toBeGreaterThan(0);

  expect(
    runtimeErrors,
    `explore-v2 smoke emitted runtime errors:\n${runtimeErrors.join("\n")}`
  ).toEqual([]);
});
