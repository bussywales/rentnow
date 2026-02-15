import { test, expect, type Page } from "@playwright/test";

const SHOULD_RUN = process.env.E2E_ENABLE_HOST_DASHBOARD === "true";
const HOST_EMAIL =
  process.env.E2E_HOST_EMAIL ||
  process.env.PLAYWRIGHT_USER_EMAIL ||
  process.env.E2E_EMAIL ||
  "";
const HOST_PASSWORD =
  process.env.E2E_HOST_PASSWORD ||
  process.env.PLAYWRIGHT_USER_PASSWORD ||
  process.env.E2E_PASSWORD ||
  "";
const HAS_HOST_CREDS = !!HOST_EMAIL && !!HOST_PASSWORD;

if (!SHOULD_RUN) {
  test.skip(
    true,
    "Host dashboard overflow e2e disabled (set E2E_ENABLE_HOST_DASHBOARD=true to run)"
  );
}

const VIEWPORTS = [320, 360, 390, 414] as const;
const VIEWS = ["all", "needs-attention", "drafts", "ready"] as const;

async function loginIfPossible(page: Page) {
  if (!HAS_HOST_CREDS) return;

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(HOST_EMAIL);
  await page.getByLabel(/password/i).fill(HOST_PASSWORD);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/(host|dashboard|tenant\/home)/, { timeout: 20_000 });
  await page.goto("/host?view=all");
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const payload = await page.evaluate(() => {
    const root = document.documentElement;
    const innerWidth = window.innerWidth;
    const offenders: Array<{
      selector: string;
      left: number;
      right: number;
      width: number;
    }> = [];

    for (const node of Array.from(document.querySelectorAll("*"))) {
      const element = node as HTMLElement;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") continue;

      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (rect.left >= -0.5 && rect.right <= innerWidth + 0.5) continue;

      const testId = element.getAttribute("data-testid");
      const idPart = element.id ? `#${element.id}` : "";
      const testIdPart = testId ? `[data-testid="${testId}"]` : "";
      const classPart = element.className
        ? `.${element.className
            .toString()
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 3)
            .join(".")}`
        : "";

      offenders.push({
        selector: `${element.tagName.toLowerCase()}${idPart}${testIdPart}${classPart}`,
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
      });
      if (offenders.length >= 8) break;
    }

    return {
      innerWidth,
      scrollWidth: root.scrollWidth,
      offenders,
    };
  });

  expect(
    payload.scrollWidth,
    `${label} overflow: scrollWidth=${payload.scrollWidth} innerWidth=${payload.innerWidth} offenders=${JSON.stringify(payload.offenders)}`
  ).toBeLessThanOrEqual(payload.innerWidth + 1);
}

test.describe("Host dashboard mobile overflow", () => {
  test("my listings views do not pan horizontally", async ({ page }) => {
    await loginIfPossible(page);

    await page.goto("/host?view=all");
    if (page.url().includes("/auth/login")) {
      test.skip(
        true,
        "Host auth required. Set E2E_HOST_EMAIL/E2E_HOST_PASSWORD (or PLAYWRIGHT_USER_EMAIL/PASSWORD) to run overflow checks."
      );
    }

    for (const width of VIEWPORTS) {
      await page.setViewportSize({ width, height: 900 });
      for (const view of VIEWS) {
        await page.goto(`/host?view=${view}`);
        await page.waitForTimeout(300);
        await assertNoHorizontalOverflow(page, `view=${view} width=${width}`);
      }
    }
  });
});

