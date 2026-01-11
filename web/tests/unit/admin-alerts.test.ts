import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAdminAlertsFromSignals,
  buildAlertWebhookPayload,
} from "../../lib/admin/alerting";

void test("buildAdminAlertsFromSignals classifies severity and windows", () => {
  const alerts = buildAdminAlertsFromSignals({
    nowIso: "2026-01-10T10:00:00.000Z",
    push: {
      configured: true,
      failuresLastHour: 25,
      unavailableLastHour: 0,
      totalPushLastHour: 40,
      subscriptionsTotal: 0,
      subscriptionsLast24h: 0,
    },
    throttle: {
      last15m: 30,
      lastHour: 55,
    },
    dataQuality: {
      missingPhotos: 30,
      missingCountryCode: 80,
      missingDepositCurrency: 40,
      missingSizeUnit: 0,
      listingTypeMissing: 60,
    },
  });

  const keys = alerts.map((alert) => alert.key);
  assert.ok(keys.includes("push-failure-spike"));
  assert.ok(keys.includes("push-subscriptions-zero"));
  assert.ok(keys.includes("messaging-throttle-critical"));
  assert.ok(keys.includes("data-quality-missing-photos"));
  assert.ok(alerts.every((alert) => alert.window.length > 0));
});

void test("buildAlertWebhookPayload strips sensitive fields and urls", () => {
  const payload = buildAlertWebhookPayload([
    {
      key: "push-failure-spike",
      severity: "critical",
      title: "Push failures https://example.com",
      summary: "access_token=secret https://evil.com",
      signal: "failures=10",
      window: "last 1h",
      recommended_action: "Check token and secret",
      runbook_link: "/admin/alerts#runbook",
      admin_path: "/admin/alerts",
      last_updated_at: "2026-01-10T10:00:00.000Z",
      // @ts-expect-error - extra fields should be ignored
      email: "admin@example.com",
    },
  ]);

  const payloadText = JSON.stringify(payload);
  assert.ok(!payloadText.includes("http://"));
  assert.ok(!payloadText.includes("https://"));
  assert.ok(!payloadText.includes("access_token"));
  assert.ok(!payloadText.includes("refresh_token"));
  assert.ok(!payloadText.includes("secret"));
  assert.ok(!payloadText.includes("email"));
  assert.ok(payloadText.length < 10000);
});
