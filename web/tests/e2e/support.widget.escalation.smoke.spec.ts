import { expect, test, type Page } from "@playwright/test";
import { smokeSelectors } from "./utils/selectors";

const KNOWN_BENIGN_CONSOLE_PATTERNS: RegExp[] = [
  /Download the React DevTools/i,
  /Failed to load resource: the server responded with a status of 401 \(Unauthorized\)/i,
];

type AssistantPayload = {
  answer: string;
  suggestedArticles: Array<{ title: string; snippet: string; href: string; score: number }>;
  confidence: "high" | "med" | "low";
  shouldEscalate: boolean;
  escalationReason: string | null;
};

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

test.describe("support widget escalation smoke", () => {
  test("anonymous user can ask assistant and escalate from widget", async ({ page }) => {
    const runtimeErrors = attachRuntimeErrorGuards(page);
    let assistantCalls = 0;
    let escalationCalls = 0;
    let escalationPayload: Record<string, unknown> | null = null;

    await page.route("**/api/support/assistant", async (route) => {
      assistantCalls += 1;
      const raw = route.request().postData() || "{}";
      const requestBody = JSON.parse(raw) as { message?: string };
      const message = (requestBody.message || "your request").trim();
      const payload: AssistantPayload = {
        answer: `Booking requests are approved by hosts, usually within 12 hours. I can escalate this now if needed.`,
        suggestedArticles: [
          {
            title: "How shortlet booking requests work",
            snippet: `This answer was generated for "${message}".`,
            href: "/help/tenant/shortlets-trips-timeline",
            score: 9,
          },
        ],
        confidence: "med",
        shouldEscalate: true,
        escalationReason: "smoke_test_escalation",
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
    });

    await page.route("**/api/support/escalate", async (route) => {
      escalationCalls += 1;
      const raw = route.request().postData() || "{}";
      escalationPayload = JSON.parse(raw) as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          requestId: "req_smoke_support_001",
          emailSent: true,
          emailError: null,
        }),
      });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem("ph_marketplace_disclaimer_dismissed_version", "v1");
    });

    await page.goto("/shortlets", { waitUntil: "domcontentloaded" });
    const widgetRoot = page.getByTestId(smokeSelectors.supportWidgetRoot);
    const widgetButton = page.getByTestId(smokeSelectors.supportWidgetButton);
    const widgetPanel = page.getByTestId(smokeSelectors.supportWidgetPanel);

    await expect.poll(async () => widgetRoot.count(), { timeout: 20_000 }).toBeGreaterThan(0);
    await expect
      .poll(
        async () => {
          const [buttonVisible, panelVisible] = await Promise.all([
            widgetButton.isVisible().catch(() => false),
            widgetPanel.isVisible().catch(() => false),
          ]);
          return buttonVisible || panelVisible;
        },
        { timeout: 20_000 }
      )
      .toBeTruthy();

    if (await widgetButton.isVisible().catch(() => false)) {
      await widgetButton.click();
    }
    await expect(widgetPanel).toBeVisible();

    await page
      .getByTestId(smokeSelectors.supportWidgetInput)
      .fill("How do booking requests work?");

    const assistantResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/support/assistant") &&
        response.status() === 200,
      { timeout: 20_000 }
    );

    await page.getByTestId(smokeSelectors.supportWidgetSend).click();
    await assistantResponse;

    await expect
      .poll(
        async () =>
          page
            .locator('[data-testid="support-widget-chat-thread"] div[class*="rounded-lg"]')
            .count(),
        { timeout: 15_000 }
      )
      .toBeGreaterThanOrEqual(2);

    await expect(page.getByTestId(smokeSelectors.supportWidgetEscalate)).toBeVisible();
    await page.getByTestId(smokeSelectors.supportWidgetEscalate).click();

    const emailValue =
      process.env.PLAYWRIGHT_TEST_EMAIL ||
      process.env.PLAYWRIGHT_ADMIN_EMAIL ||
      "smoke+support@propatyhub.test";
    await page
      .locator('[data-testid="support-widget-panel"] input[type="email"]')
      .first()
      .fill(emailValue);

    const escalateResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/support/escalate") &&
        response.status() === 200,
      { timeout: 20_000 }
    );

    await page.getByRole("button", { name: /send to support/i }).click();
    await escalateResponse;

    const success = page.getByTestId(smokeSelectors.supportWidgetTicketSuccess);
    await expect(success).toBeVisible();
    await expect(success).toContainText(/Ticket received/i);

    expect(assistantCalls, "assistant endpoint should be called").toBeGreaterThanOrEqual(1);
    expect(escalationCalls, "escalation endpoint should be called").toBeGreaterThanOrEqual(1);
    expect(
      typeof escalationPayload?.message === "string" && escalationPayload.message.length >= 10,
      "escalation payload should include support message"
    ).toBeTruthy();
    expect(
      runtimeErrors,
      `support widget flow emitted runtime errors:\n${runtimeErrors.join("\n")}`
    ).toEqual([]);
  });
});
