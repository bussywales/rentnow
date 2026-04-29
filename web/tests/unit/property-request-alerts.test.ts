import test from "node:test";
import assert from "node:assert/strict";
import { buildPropertyRequestPublishedAlertEmail } from "@/lib/email/templates/property-request-published-alert";
import { notifyHostsOfPublishedPropertyRequest } from "@/lib/requests/property-request-alerts.server";
import type { PropertyRequest } from "@/lib/requests/property-requests";

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
  createdAt: "2026-03-16T10:00:00.000Z",
  updatedAt: "2026-03-16T10:00:00.000Z",
};

void test("property request published alerts only send to opted-in matching supply recipients", async () => {
  const sentTo: string[] = [];
  const result = await notifyHostsOfPublishedPropertyRequest(request, {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    getSiteUrl: async () => "https://www.propatyhub.com",
    loadOptedInProfiles: async () => [
      {
        id: "landlord-1",
        role: "landlord",
        property_request_alerts_enabled: true,
      },
      {
        id: "agent-1",
        role: "agent",
        property_request_alerts_enabled: true,
      },
      {
        id: "agent-2",
        role: "agent",
        property_request_alerts_enabled: true,
      },
      {
        id: "landlord-2",
        role: "landlord",
        property_request_alerts_enabled: true,
      },
      {
        id: "agent-off",
        role: "agent",
        property_request_alerts_enabled: false,
      },
    ],
    loadMatchingSupplyOwnerIds: async () => ["landlord-1"],
    loadActiveDelegations: async () => [{ agent_id: "agent-1", landlord_id: "landlord-1" }],
    getUserEmail: async (_client, userId) => `${userId}@example.com`,
    sendEmail: async ({ to, subject, html }) => {
      sentTo.push(to);
      assert.equal(subject, "New property request: 2 bedroom apartment near Lekki");
      assert.match(html, /2 bedroom apartment near Lekki/);
      assert.match(html, /Lekki, Lagos/);
      assert.match(html, /Apartment/);
      assert.match(html, /2 bedrooms/);
      assert.match(html, /Within 30 days/);
      assert.match(html, /https:\/\/www\.propatyhub\.com\/requests\/req-1/);
      return { ok: true };
    },
  });

  assert.deepEqual(sentTo.sort(), ["agent-1@example.com", "landlord-1@example.com"]);
  assert.deepEqual(result, {
    ok: true,
    attempted: 2,
    sent: 2,
    skipped: 3,
  });
});

void test("property request published alerts skip when no matching supply exists", async () => {
  const result = await notifyHostsOfPublishedPropertyRequest(request, {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    getSiteUrl: async () => "https://www.propatyhub.com",
    loadOptedInProfiles: async () => [
      { id: "agent-1", role: "agent", property_request_alerts_enabled: true },
    ],
    loadMatchingSupplyOwnerIds: async () => [],
    loadActiveDelegations: async () => [],
    getUserEmail: async () => null,
    sendEmail: async () => ({ ok: true }),
  });

  assert.deepEqual(result, {
    ok: true,
    attempted: 0,
    sent: 0,
    skipped: 1,
  });
});

void test("property request published email template renders request summary and CTA", () => {
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
    requestUrl: "https://www.propatyhub.com/requests/req-1",
  });

  assert.equal(email.subject, "New property request: 2 bedroom apartment near Lekki");
  assert.match(email.html, /Request req-1/);
  assert.match(email.html, /2 bedroom apartment near Lekki/);
  assert.match(email.html, /Lekki, Lagos/);
  assert.match(email.html, /NGN 150,000 - NGN 350,000/);
  assert.match(email.html, /View request/);
});
