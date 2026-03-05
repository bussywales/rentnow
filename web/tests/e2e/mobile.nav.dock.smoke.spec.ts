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

test("mobile glass dock renders, supports dock navigation taps, and stays hidden on admin/auth route", async ({
  page,
}) => {
  const runtimeErrors = attachRuntimeErrorGuards(page);

  const dismissDisclaimerIfPresent = async () => {
    const banner = page.getByTestId("legal-disclaimer-banner");
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const visible = await banner.isVisible().catch(() => false);
      if (visible) {
        await banner
          .getByRole("button", { name: /Dismiss marketplace disclaimer/i })
          .click({ force: true });
        await expect(banner).toBeHidden();
        return;
      }
      await page.waitForTimeout(150);
    }
  };

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await dismissDisclaimerIfPresent();
  await expect(page.getByTestId(smokeSelectors.glassDock)).toBeVisible();
  await page
    .getByTestId(smokeSelectors.glassDockSearchTrigger)
    .evaluate((node) => (node as HTMLElement).click());
  await expect(page.getByTestId(smokeSelectors.glassDockSearchOverlay)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId(smokeSelectors.glassDockSearchOverlay)).toBeHidden();

  await page.getByTestId(smokeSelectors.glassDockLinkExploreV2).click();
  await page.waitForURL(/\/explore-v2(?:\?|$)/, { timeout: 15_000 });

  await page.getByTestId(smokeSelectors.glassDockLinkSaved).click();
  await page.waitForURL(
    (url) => {
      const pathname = new URL(url).pathname;
      return pathname.startsWith("/tenant/saved") || pathname.startsWith("/auth");
    },
    { timeout: 15_000 }
  );

  await page.goto("/admin/settings", { waitUntil: "domcontentloaded" });
  const adminAttemptPath = new URL(page.url()).pathname;
  if (adminAttemptPath.startsWith("/admin") || adminAttemptPath.startsWith("/auth")) {
    await expect(page.getByTestId(smokeSelectors.glassDock)).toBeHidden();
  }

  expect(runtimeErrors, `mobile nav dock smoke emitted runtime errors:\n${runtimeErrors.join("\n")}`).toEqual(
    []
  );
});
