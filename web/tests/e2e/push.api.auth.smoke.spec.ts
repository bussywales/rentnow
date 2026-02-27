import { test, expect } from "@playwright/test";

test.describe("push api auth smoke", () => {
  test("push endpoints stay protected for anonymous callers", async ({ request, baseURL }) => {
    const base = (baseURL || "http://localhost:3000").replace(/\/$/, "");

    const statusResponse = await request.get(`${base}/api/push/status`);
    expect([401, 503]).toContain(statusResponse.status());

    const subscribeResponse = await request.post(`${base}/api/push/subscribe`, {
      data: {
        endpoint: "https://example.com/push-endpoint",
        keys: { p256dh: "key", auth: "auth" },
      },
    });
    expect([401, 503]).toContain(subscribeResponse.status());

    const unsubscribeResponse = await request.post(`${base}/api/push/unsubscribe`, {
      data: {
        endpoint: "https://example.com/push-endpoint",
      },
    });
    expect([401, 503]).toContain(unsubscribeResponse.status());
  });
});
