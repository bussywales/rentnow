import test from "node:test";
import assert from "node:assert/strict";
import { buildPropertyRequestPublishedAlertEmail } from "@/lib/email/templates/property-request-published-alert";
import { notifyHostsOfPublishedPropertyRequest } from "@/lib/requests/property-request-alerts.server";
import type { PropertyRequest } from "@/lib/requests/property-requests";
import type { PropertyRequestAlertSubscription } from "@/lib/requests/property-request-alert-subscriptions";

const request: PropertyRequest = {
  id: "req-1",
  ownerUserId: "tenant-1",
  ownerRole: "tenant",
  intent: "rent",
  marketCode: "NG",
  currencyCode: "NGN",
  title: "2 bedroom apartment near Lekki",
  city: "Lagos",
  area: "Lekki",
  locationText: "Lekki Phase 1",
  budgetMin: 15000000,
  budgetMax: 35000000,
  propertyType: "apartment",
  bedrooms: 2,
  bathrooms: null,
  furnished: null,
  moveTimeline: "within_30_days",
  shortletDuration: null,
  notes: "Needs parking",
  status: "open",
  publishedAt: "2026-03-16T10:00:00.000Z",
  expiresAt: "2026-04-15T10:00:00.000Z",
  extensionCount: 0,
  lastExpiryReminderForExpiresAt: null,
  createdAt: "2026-03-16T10:00:00.000Z",
  updatedAt: "2026-03-16T10:00:00.000Z",
};

function createSubscription(
  input: Partial<PropertyRequestAlertSubscription> & Pick<PropertyRequestAlertSubscription, "id" | "userId" | "role">
): PropertyRequestAlertSubscription {
  return {
    id: input.id,
    userId: input.userId,
    role: input.role,
    marketCode: input.marketCode ?? "NG",
    intent: input.intent ?? null,
    propertyType: input.propertyType ?? null,
    city: input.city ?? null,
    bedroomsMin: input.bedroomsMin ?? null,
    isActive: input.isActive ?? true,
    createdAt: input.createdAt ?? "2026-03-16T10:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-03-16T10:00:00.000Z",
  };
}

void test("property request subscriber alerts only send to active matching subscriptions with master toggle enabled", async () => {
  const sentTo: string[] = [];
  const deliveryLog: Array<{ subscriptionId: string; deliveryStatus: "sent" | "failed" }> = [];
  const analyticsRecipients: string[] = [];

  const result = await notifyHostsOfPublishedPropertyRequest(request, {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    getSiteUrl: async () => "https://www.propatyhub.com",
    loadActiveSubscriptions: async () => [
      createSubscription({
        id: "sub-agent-1",
        userId: "agent-1",
        role: "agent",
        intent: "rent",
        propertyType: "apartment",
        city: "lagos",
        bedroomsMin: 2,
      }),
      createSubscription({
        id: "sub-landlord-1",
        userId: "landlord-1",
        role: "landlord",
        intent: "rent",
      }),
      createSubscription({
        id: "sub-agent-off",
        userId: "agent-off",
        role: "agent",
        city: "Lagos",
      }),
    ],
    loadProfileAlertPreferences: async () => [
      { id: "agent-1", role: "agent", property_request_alerts_enabled: true },
      { id: "landlord-1", role: "landlord", property_request_alerts_enabled: true },
      { id: "agent-off", role: "agent", property_request_alerts_enabled: false },
    ],
    loadExistingDeliveries: async () => new Set<string>(),
    recordDelivery: async (_client, input) => {
      deliveryLog.push({
        subscriptionId: input.subscriptionId,
        deliveryStatus: input.deliveryStatus,
      });
    },
    getUserEmail: async (_client, userId) => `${userId}@example.com`,
    sendEmail: async ({ to, subject, html }) => {
      sentTo.push(to);
      assert.equal(subject, "New property request: 2 bedroom apartment near Lekki");
      assert.match(html, /2 bedroom apartment near Lekki/);
      assert.match(html, /Lekki, Lagos/);
      assert.match(html, /Apartment/);
      assert.match(html, /2 bedrooms/);
      assert.match(html, /Within 30 days/);
      assert.match(html, /https:\/\/www\.propatyhub\.com\/requests\/req-1\?source=request-alert/);
      assert.doesNotMatch(html, /tenant-1/);
      return { ok: true };
    },
    logSubscriberAlertSent: async ({ userId }) => {
      analyticsRecipients.push(userId);
    },
  });

  assert.deepEqual(sentTo.sort(), ["agent-1@example.com", "landlord-1@example.com"]);
  assert.deepEqual(
    deliveryLog.sort((left, right) => left.subscriptionId.localeCompare(right.subscriptionId)),
    [
      { subscriptionId: "sub-agent-1", deliveryStatus: "sent" },
      { subscriptionId: "sub-landlord-1", deliveryStatus: "sent" },
    ]
  );
  assert.deepEqual(analyticsRecipients.sort(), ["agent-1", "landlord-1"]);
  assert.deepEqual(result, {
    ok: true,
    attempted: 2,
    sent: 2,
    skipped: 1,
  });
});

void test("property request subscriber alerts suppress duplicate delivery per subscription and request", async () => {
  let sent = false;
  const result = await notifyHostsOfPublishedPropertyRequest(request, {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    getSiteUrl: async () => "https://www.propatyhub.com",
    loadActiveSubscriptions: async () => [
      createSubscription({ id: "sub-1", userId: "agent-1", role: "agent", intent: "rent" }),
    ],
    loadProfileAlertPreferences: async () => [
      { id: "agent-1", role: "agent", property_request_alerts_enabled: true },
    ],
    loadExistingDeliveries: async () => new Set<string>(["sub-1"]),
    recordDelivery: async () => undefined,
    getUserEmail: async () => "agent-1@example.com",
    sendEmail: async () => {
      sent = true;
      return { ok: true };
    },
    logSubscriberAlertSent: async () => undefined,
  });

  assert.equal(sent, false);
  assert.deepEqual(result, {
    ok: true,
    attempted: 0,
    sent: 0,
    skipped: 1,
  });
});

void test("property request published email template renders request summary CTA and manage link", () => {
  const email = buildPropertyRequestPublishedAlertEmail({
    requestId: "req-1",
    titleLabel: "2 bedroom apartment near Lekki",
    intentLabel: "Rent",
    marketLabel: "NG",
    locationLabel: "Lekki, Lagos",
    budgetLabel: "NGN 150,000 - NGN 350,000",
    propertyTypeLabel: "Apartment",
    bedroomsLabel: "2 bedrooms",
    moveTimelineLabel: "Within 30 days",
    requestUrl: "https://www.propatyhub.com/requests/req-1?source=request-alert",
    manageAlertsUrl: "https://www.propatyhub.com/dashboard/saved-searches#request-alerts",
  });

  assert.equal(email.subject, "New property request: 2 bedroom apartment near Lekki");
  assert.match(email.html, /Request req-1/);
  assert.match(email.html, /2 bedroom apartment near Lekki/);
  assert.match(email.html, /Lekki, Lagos/);
  assert.match(email.html, /NGN 150,000 - NGN 350,000/);
  assert.match(email.html, /View request/);
  assert.match(email.html, /your alerts settings/);
  assert.match(email.html, /dashboard\/saved-searches#request-alerts/);
});
