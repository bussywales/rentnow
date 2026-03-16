import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPropertyRequestAdminAnalytics,
  buildPropertyRequestResponseSummaryMap,
  matchesAdminPropertyRequestListFilters,
  parseAdminPropertyRequestListFilters,
  type PropertyRequestAnalyticsResponseRow,
} from "@/lib/requests/property-requests-admin";
import type { PropertyRequest } from "@/lib/requests/property-requests";

const requests: PropertyRequest[] = [
  {
    id: "req-1",
    ownerUserId: "tenant-1",
    ownerRole: "tenant",
    intent: "rent",
    marketCode: "NG",
    currencyCode: "NGN",
    city: "Lagos",
    area: "Lekki",
    locationText: "Lekki Phase 1",
    budgetMin: 100000,
    budgetMax: 200000,
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    furnished: true,
    moveTimeline: "within_30_days",
    shortletDuration: null,
    notes: "Needs parking",
    status: "open",
    publishedAt: "2026-03-01T10:00:00.000Z",
    expiresAt: "2026-03-31T10:00:00.000Z",
    createdAt: "2026-03-01T09:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z",
  },
  {
    id: "req-2",
    ownerUserId: "tenant-2",
    ownerRole: "tenant",
    intent: "buy",
    marketCode: "GB",
    currencyCode: "GBP",
    city: "London",
    area: "Croydon",
    locationText: null,
    budgetMin: 300000,
    budgetMax: 500000,
    propertyType: "house",
    bedrooms: 3,
    bathrooms: 2,
    furnished: null,
    moveTimeline: "planning_ahead",
    shortletDuration: null,
    notes: null,
    status: "closed",
    publishedAt: "2026-03-02T10:00:00.000Z",
    expiresAt: "2026-04-01T10:00:00.000Z",
    createdAt: "2026-03-02T08:00:00.000Z",
    updatedAt: "2026-03-05T10:00:00.000Z",
  },
  {
    id: "req-3",
    ownerUserId: "tenant-3",
    ownerRole: "tenant",
    intent: "shortlet",
    marketCode: "US",
    currencyCode: "USD",
    city: "Miami",
    area: null,
    locationText: "Brickell",
    budgetMin: 200,
    budgetMax: 350,
    propertyType: "studio",
    bedrooms: 0,
    bathrooms: 1,
    furnished: true,
    moveTimeline: "immediately",
    shortletDuration: "2 weeks",
    notes: "Close to downtown",
    status: "draft",
    publishedAt: null,
    expiresAt: null,
    createdAt: "2026-03-03T08:00:00.000Z",
    updatedAt: "2026-03-03T09:00:00.000Z",
  },
  {
    id: "req-4",
    ownerUserId: "tenant-4",
    ownerRole: "tenant",
    intent: "rent",
    marketCode: "NG",
    currencyCode: "NGN",
    city: "Abuja",
    area: "Wuse",
    locationText: null,
    budgetMin: 150000,
    budgetMax: 280000,
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    furnished: false,
    moveTimeline: "within_90_days",
    shortletDuration: null,
    notes: null,
    status: "expired",
    publishedAt: "2026-03-02T10:00:00.000Z",
    expiresAt: "2026-03-10T10:00:00.000Z",
    createdAt: "2026-03-02T09:00:00.000Z",
    updatedAt: "2026-03-10T10:00:00.000Z",
  },
];

const responses: PropertyRequestAnalyticsResponseRow[] = [
  {
    id: "res-1",
    request_id: "req-1",
    responder_user_id: "agent-1",
    created_at: "2026-03-01T11:00:00.000Z",
  },
  {
    id: "res-2",
    request_id: "req-1",
    responder_user_id: "agent-2",
    created_at: "2026-03-01T15:00:00.000Z",
  },
  {
    id: "res-3",
    request_id: "req-2",
    responder_user_id: "landlord-1",
    created_at: "2026-03-03T08:00:00.000Z",
  },
];

void test("admin property requests filter parser normalizes q and status", () => {
  const parsed = parseAdminPropertyRequestListFilters({ q: "  Lekki  ", status: "open" });
  assert.deepEqual(parsed, { q: "Lekki", status: "open" });
  assert.deepEqual(parseAdminPropertyRequestListFilters({ status: "bogus" }), {
    q: "",
    status: "all",
  });
});

void test("admin property request filters match search text and status", () => {
  assert.equal(
    matchesAdminPropertyRequestListFilters(requests[0], { q: "lekki", status: "all" }),
    true
  );
  assert.equal(
    matchesAdminPropertyRequestListFilters(requests[0], { q: "miami", status: "all" }),
    false
  );
  assert.equal(
    matchesAdminPropertyRequestListFilters(requests[0], { q: "", status: "closed" }),
    false
  );
});

void test("admin property request response summary map counts responses and timing", () => {
  const summary = buildPropertyRequestResponseSummaryMap(requests, responses);
  assert.deepEqual(summary.get("req-1"), {
    responseCount: 2,
    responderCount: 2,
    firstResponseAt: "2026-03-01T11:00:00.000Z",
    latestResponseAt: "2026-03-01T15:00:00.000Z",
    hoursToFirstResponse: 2,
  });
  assert.equal(summary.get("req-4")?.responseCount, 0);
});

void test("admin property request analytics compute usage and first-response stats", () => {
  const analytics = buildPropertyRequestAdminAnalytics(requests, responses);
  assert.deepEqual(analytics, {
    requestsCreated: 4,
    openRequests: 1,
    closedRequests: 1,
    expiredRequests: 1,
    removedRequests: 0,
    requestsWithResponses: 2,
    requestsWithoutResponses: 1,
    totalResponsesSent: 3,
    averageFirstResponseHours: 13,
    medianFirstResponseHours: 13,
  });
});
