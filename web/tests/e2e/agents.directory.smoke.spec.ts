import { expect, test, type Page } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";

const KNOWN_BENIGN_CONSOLE_PATTERNS: RegExp[] = [/Download the React DevTools/i];

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

test.describe("agents directory smoke", () => {
  test("directory page renders with stable core selectors", async ({ page }) => {
    const runtimeErrors = attachRuntimeErrorGuards(page);

    await page.goto("/agents", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: /find an agent/i })).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.agentsDirectoryPage)).toBeVisible();
    await expect(page.getByTestId(smokeSelectors.agentsDirectorySearch)).toBeVisible();

    expect(
      runtimeErrors,
      `agents directory page emitted runtime errors:\n${runtimeErrors.join("\n")}`
    ).toEqual([]);
  });

  test("search updates directory results when seeded agents are available", async ({ page }) => {
    await page.goto("/agents", { waitUntil: "domcontentloaded" });

    const cards = page.getByTestId(smokeSelectors.agentsDirectoryCard);
    const initialCount = await cards.count();
    if (initialCount === 0) {
      await expect(page.getByText(/No verified agents yet/i)).toBeVisible();
      test.skip(true, "No seeded agents available; skipping search assertion.");
    }

    const firstName = (await cards.first().locator("h3").textContent())?.trim() || "";
    const searchToken = firstName.split(/\s+/)[0]?.slice(0, 3) || "age";

    const searchResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes("/api/agents/search") &&
        response.status() === 200,
      { timeout: 20_000 }
    );

    await page.getByTestId(smokeSelectors.agentsDirectorySearch).fill(searchToken);
    await searchResponse;

    await expect(page.getByTestId(smokeSelectors.agentsDirectoryResults)).toBeVisible();
  });
});
