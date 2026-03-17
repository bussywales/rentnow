import test from "node:test";
import assert from "node:assert/strict";
import {
  PROPERTY_REQUEST_MAX_EXTENSION_COUNT,
  canExtendPropertyRequestExpiry,
  isPropertyRequestDueForExpiryReminder,
  resolveExtendedPropertyRequestExpiry,
  type PropertyRequest,
  type PropertyRequestRecord,
} from "@/lib/requests/property-requests";
import {
  dispatchPropertyRequestExpiryReminders,
  resolvePropertyRequestExtension,
  resolvePropertyRequestReminderWindow,
} from "@/lib/requests/property-request-retention.server";

const baseRequest: PropertyRequest = {
  id: "req-1",
  ownerUserId: "tenant-1",
  ownerRole: "tenant",
  intent: "rent",
  marketCode: "NG",
  currencyCode: "NGN",
  city: "Lagos",
  area: "Lekki",
  locationText: "Lekki Phase 1",
  budgetMin: 25000000,
  budgetMax: 45000000,
  propertyType: "apartment",
  bedrooms: 2,
  bathrooms: 2,
  furnished: null,
  moveTimeline: "within_30_days",
  shortletDuration: null,
  notes: "Need parking",
  status: "open",
  publishedAt: "2026-03-01T10:00:00.000Z",
  expiresAt: "2026-03-31T10:00:00.000Z",
  extensionCount: 0,
  lastExpiryReminderForExpiresAt: null,
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
};

const baseRecord: PropertyRequestRecord = {
  id: "req-1",
  owner_user_id: "tenant-1",
  owner_role: "tenant",
  intent: "rent",
  market_code: "NG",
  currency_code: "NGN",
  city: "Lagos",
  area: "Lekki",
  location_text: "Lekki Phase 1",
  budget_min: 25000000,
  budget_max: 45000000,
  property_type: "apartment",
  bedrooms: 2,
  bathrooms: 2,
  furnished: null,
  move_timeline: "within_30_days",
  shortlet_duration: null,
  notes: "Need parking",
  status: "open",
  published_at: "2026-03-01T10:00:00.000Z",
  expires_at: "2026-03-31T10:00:00.000Z",
  extension_count: 0,
  last_expiry_reminder_for_expires_at: null,
  created_at: "2026-03-01T10:00:00.000Z",
  updated_at: "2026-03-01T10:00:00.000Z",
};

void test("expiry reminder eligibility targets the 3-day window and skips already-reminded requests", () => {
  const now = new Date("2026-03-28T12:00:00.000Z");

  assert.equal(
    isPropertyRequestDueForExpiryReminder({
      status: "open",
      publishedAt: baseRequest.publishedAt,
      expiresAt: "2026-03-31T10:00:00.000Z",
      lastReminderForExpiresAt: null,
      now,
    }),
    true
  );

  assert.equal(
    isPropertyRequestDueForExpiryReminder({
      status: "open",
      publishedAt: baseRequest.publishedAt,
      expiresAt: "2026-03-31T10:00:00.000Z",
      lastReminderForExpiresAt: "2026-03-31T10:00:00.000Z",
      now,
    }),
    false
  );

  assert.equal(
    isPropertyRequestDueForExpiryReminder({
      status: "closed",
      publishedAt: baseRequest.publishedAt,
      expiresAt: "2026-03-31T10:00:00.000Z",
      now,
    }),
    false
  );
});

void test("request extension eligibility is limited to the late-expiry window and extension cap", () => {
  const now = new Date("2026-03-28T12:00:00.000Z");

  assert.equal(
    canExtendPropertyRequestExpiry({
      status: "open",
      publishedAt: baseRequest.publishedAt,
      expiresAt: baseRequest.expiresAt,
      extensionCount: 0,
      now,
    }),
    true
  );

  assert.equal(
    canExtendPropertyRequestExpiry({
      status: "open",
      publishedAt: baseRequest.publishedAt,
      expiresAt: baseRequest.expiresAt,
      extensionCount: PROPERTY_REQUEST_MAX_EXTENSION_COUNT,
      now,
    }),
    false
  );

  assert.equal(
    canExtendPropertyRequestExpiry({
      status: "open",
      publishedAt: baseRequest.publishedAt,
      expiresAt: baseRequest.expiresAt,
      extensionCount: 0,
      now: new Date("2026-03-20T12:00:00.000Z"),
    }),
    false
  );
});

void test("extension resolver adds 30 days from the current expiry", () => {
  const nextExpiresAt = resolveExtendedPropertyRequestExpiry({
    expiresAt: "2026-03-31T10:00:00.000Z",
    now: new Date("2026-03-28T12:00:00.000Z"),
  });

  assert.equal(nextExpiresAt, "2026-04-30T10:00:00.000Z");

  const extension = resolvePropertyRequestExtension({
    request: baseRequest,
    now: new Date("2026-03-28T12:00:00.000Z"),
  });

  assert.equal(extension.ok, true);
  if (extension.ok) {
    assert.equal(extension.nextExpiresAt, "2026-04-30T10:00:00.000Z");
    assert.equal(extension.nextExtensionCount, 1);
  }
});

void test("reminder window resolves to the expected catch-up bounds", () => {
  const window = resolvePropertyRequestReminderWindow(new Date("2026-03-28T12:00:00.000Z"));
  assert.equal(window.lowerBound, "2026-03-30T10:00:00.000Z");
  assert.equal(window.upperBound, "2026-03-31T12:00:00.000Z");
});

void test("dispatch sends reminder emails for due requests and marks the expiry cycle", async () => {
  const emails: Array<{ to: string; subject: string; html: string }> = [];
  const marked: Array<{ requestId: string; expiresAt: string }> = [];

  const result = await dispatchPropertyRequestExpiryReminders({
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({ auth: { admin: { getUserById: async () => ({ data: { user: { email: "tenant@example.com" } } }) } } }) as never,
    getSiteUrl: async () => "https://www.propatyhub.com",
    now: () => new Date("2026-03-28T12:00:00.000Z"),
    loadCandidateRequests: async () => [baseRecord],
    getUserEmail: async () => "tenant@example.com",
    markReminderSent: async (_client, input) => {
      marked.push(input);
      return { ok: true };
    },
    sendEmail: async (input) => {
      emails.push(input);
      return { ok: true };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.scanned, 1);
  assert.equal(result.due, 1);
  assert.equal(result.sent, 1);
  assert.equal(result.errors.length, 0);
  assert.equal(emails[0]?.to, "tenant@example.com");
  assert.equal(emails[0]?.subject, "Your property request expires in 3 days");
  assert.match(String(emails[0]?.html || ""), /Extend request/);
  assert.match(String(emails[0]?.html || ""), /\/requests\/req-1\/extend/);
  assert.deepEqual(marked, [{ requestId: "req-1", expiresAt: "2026-03-31T10:00:00.000Z" }]);
});

void test("dispatch skips requests without a deliverable owner email", async () => {
  const result = await dispatchPropertyRequestExpiryReminders({
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({ auth: { admin: { getUserById: async () => ({ data: { user: null } }) } } }) as never,
    getSiteUrl: async () => "https://www.propatyhub.com",
    now: () => new Date("2026-03-28T12:00:00.000Z"),
    loadCandidateRequests: async () => [baseRecord],
    getUserEmail: async () => null,
    markReminderSent: async () => ({ ok: true }),
    sendEmail: async () => ({ ok: true }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.sent, 0);
  assert.equal(result.skipped, 1);
});
