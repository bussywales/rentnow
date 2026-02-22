import { test, expect } from "@playwright/test";

const CRON_SECRET = process.env.PLAYWRIGHT_CRON_SECRET || process.env.CRON_SECRET || "";

test.describe("internal shortlet reminders smoke", () => {
  test("cron-protected reminders endpoint returns run summary", async ({ request, baseURL }) => {
    test.skip(!CRON_SECRET, "CRON secret not configured for smoke run.");

    const base = (baseURL || "http://localhost:3000").replace(/\/$/, "");
    const response = await request.post(`${base}/api/internal/shortlet/send-reminders`, {
      headers: {
        "x-cron-secret": CRON_SECRET,
      },
    });

    if (response.status() === 503) {
      test.skip(true, "Service role not configured for this smoke environment.");
    }

    expect(response.ok(), `Expected 2xx from reminders endpoint, got ${response.status()}`).toBeTruthy();

    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.ok).toBeTruthy();
    expect(payload.route).toBe("/api/internal/shortlet/send-reminders");

    for (const key of ["scanned", "due", "sent", "skipped", "errorsCount"]) {
      expect(typeof payload[key]).toBe("number");
    }
  });
});
