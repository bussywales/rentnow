import test from "node:test";
import assert from "node:assert/strict";
import {
  canSendPropertyRequestResponses,
  canRoleBrowsePropertyRequests,
  canRoleCreatePropertyRequests,
  canOwnerWritePropertyRequestStatus,
  canViewPropertyRequest,
  doesListingIntentMatchPropertyRequest,
  getPropertyRequestMoveTimelineLabel,
  getPropertyRequestIntentLabel,
  getPropertyRequestLocationSummary,
  getPropertyRequestStatusLabel,
  isPropertyRequestDiscoverable,
  isPropertyRequestOpenForResponses,
  isPropertyRequestPublishedStatus,
  propertyRequestResponseCreateSchema,
  matchesPropertyRequestDiscoverFilters,
  parsePropertyRequestDiscoverFilters,
  resolvePropertyRequestLifecycleDates,
  resolvePropertyRequestListScope,
  resolvePropertyRequestPublishMissingFields,
  type PropertyRequest,
} from "@/lib/requests/property-requests";

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
  budgetMin: 100000,
  budgetMax: 300000,
  propertyType: "apartment",
  bedrooms: 2,
  bathrooms: 2,
  furnished: true,
  moveTimeline: "within_30_days",
  shortletDuration: null,
  notes: "Needs parking",
  status: "open",
  publishedAt: "2026-03-16T10:00:00.000Z",
  expiresAt: "2026-04-15T10:00:00.000Z",
  createdAt: "2026-03-16T10:00:00.000Z",
  updatedAt: "2026-03-16T10:00:00.000Z",
};

void test("property requests create permissions stay tenant-only in phase 1", () => {
  assert.equal(canRoleCreatePropertyRequests("tenant"), true);
  assert.equal(canRoleCreatePropertyRequests("landlord"), false);
  assert.equal(canRoleCreatePropertyRequests("agent"), false);
  assert.equal(canRoleCreatePropertyRequests("admin"), false);
});

void test("property requests browse scope is discover-only for hosts/agents and full for admins", () => {
  assert.equal(canRoleBrowsePropertyRequests("tenant"), false);
  assert.equal(canRoleBrowsePropertyRequests("landlord"), true);
  assert.equal(canRoleBrowsePropertyRequests("agent"), true);
  assert.equal(canRoleBrowsePropertyRequests("admin"), true);
  assert.equal(resolvePropertyRequestListScope("tenant"), "owner");
  assert.equal(resolvePropertyRequestListScope("agent"), "discover");
  assert.equal(resolvePropertyRequestListScope("admin"), "admin");
});

void test("publish helper returns required missing fields for open requests", () => {
  const missing = resolvePropertyRequestPublishMissingFields({
    intent: "shortlet",
    marketCode: "NG",
    currencyCode: "NGN",
    city: null,
    locationText: null,
    budgetMin: null,
    budgetMax: null,
    shortletDuration: null,
  });

  assert.deepEqual(missing, ["location", "budgetMin", "budgetMax", "shortletDuration"]);
});

void test("request discoverability excludes drafts and expired rows for responder roles", () => {
  assert.equal(
    isPropertyRequestDiscoverable({
      role: "agent",
      status: "draft",
      publishedAt: null,
      expiresAt: null,
    }),
    false
  );
  assert.equal(
    isPropertyRequestDiscoverable({
      role: "landlord",
      status: "open",
      publishedAt: "2026-03-16T10:00:00.000Z",
      expiresAt: "2026-03-15T10:00:00.000Z",
      now: new Date("2026-03-16T12:00:00.000Z"),
    }),
    false
  );
  assert.equal(
    isPropertyRequestDiscoverable({
      role: "agent",
      status: "open",
      publishedAt: "2026-03-16T10:00:00.000Z",
      expiresAt: "2026-04-15T10:00:00.000Z",
      now: new Date("2026-03-16T12:00:00.000Z"),
    }),
    true
  );
});

void test("view helper keeps seeker visibility owner-only by default", () => {
  assert.equal(
    canViewPropertyRequest({
      role: "tenant",
      viewerUserId: "tenant-1",
      request: baseRequest,
    }),
    true
  );
  assert.equal(
    canViewPropertyRequest({
      role: "tenant",
      viewerUserId: "tenant-2",
      request: baseRequest,
    }),
    false
  );
});

void test("view helper allows discoverable open requests for responders and all requests for admins", () => {
  assert.equal(
    canViewPropertyRequest({
      role: "agent",
      viewerUserId: "agent-1",
      request: baseRequest,
    }),
    true
  );
  assert.equal(
    canViewPropertyRequest({
      role: "admin",
      viewerUserId: "admin-1",
      request: {
        ...baseRequest,
        status: "draft",
        publishedAt: null,
      },
    }),
    true
  );
});

void test("response helper keeps send flow private and limited to open requests", () => {
  assert.equal(
    canSendPropertyRequestResponses({
      role: "agent",
      viewerUserId: "agent-1",
      request: baseRequest,
    }),
    true
  );
  assert.equal(
    canSendPropertyRequestResponses({
      role: "tenant",
      viewerUserId: "tenant-1",
      request: baseRequest,
    }),
    false
  );
  assert.equal(
    canSendPropertyRequestResponses({
      role: "landlord",
      viewerUserId: "tenant-1",
      request: {
        ...baseRequest,
        expiresAt: "2026-03-15T10:00:00.000Z",
      },
      now: new Date("2026-03-16T10:00:00.000Z"),
    }),
    false
  );
  assert.equal(
    isPropertyRequestOpenForResponses({
      status: "open",
      publishedAt: baseRequest.publishedAt,
      expiresAt: baseRequest.expiresAt,
      now: new Date("2026-03-16T10:00:00.000Z"),
    }),
    true
  );
});

void test("response payload schema limits to three unique listings", () => {
  const parsed = propertyRequestResponseCreateSchema.safeParse({
    listingIds: [
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000001",
    ],
  });
  assert.equal(parsed.success, false);

  const tooMany = propertyRequestResponseCreateSchema.safeParse({
    listingIds: [
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002",
      "00000000-0000-0000-0000-000000000003",
      "00000000-0000-0000-0000-000000000004",
    ],
  });
  assert.equal(tooMany.success, false);
});

void test("listing intent matcher keeps responses aligned with request intent", () => {
  assert.equal(doesListingIntentMatchPropertyRequest("rent_lease", "rent"), true);
  assert.equal(doesListingIntentMatchPropertyRequest("sale", "buy"), true);
  assert.equal(doesListingIntentMatchPropertyRequest("off_plan", "buy"), true);
  assert.equal(doesListingIntentMatchPropertyRequest("shortlet", "shortlet"), true);
  assert.equal(doesListingIntentMatchPropertyRequest("sale", "rent"), false);
});

void test("discover filter parser normalises search params into a stable filter object", () => {
  const filters = parsePropertyRequestDiscoverFilters(
    new URLSearchParams({
      q: " Lekki ",
      intent: "rent",
      market: "ng",
      propertyType: "apartment",
      bedrooms: "2",
      moveTimeline: "within_30_days",
      budgetMin: "100000",
      budgetMax: "400000",
      status: "open",
    })
  );

  assert.deepEqual(filters, {
    q: "Lekki",
    intent: "rent",
    marketCode: "NG",
    propertyType: "apartment",
    bedrooms: 2,
    moveTimeline: "within_30_days",
    budgetMin: 100000,
    budgetMax: 400000,
    status: "open",
  });
});

void test("discover filter matcher keeps search and budget overlap aligned with visible demand", () => {
  assert.equal(
    matchesPropertyRequestDiscoverFilters(baseRequest, {
      q: "lekki",
      intent: "rent",
      marketCode: "NG",
      propertyType: "apartment",
      bedrooms: 2,
      moveTimeline: "within_30_days",
      budgetMin: 200000,
      budgetMax: 350000,
      status: "open",
    }),
    true
  );

  assert.equal(
    matchesPropertyRequestDiscoverFilters(baseRequest, {
      q: null,
      intent: "buy",
      marketCode: null,
      propertyType: null,
      bedrooms: null,
      moveTimeline: null,
      budgetMin: null,
      budgetMax: null,
      status: null,
    }),
    false
  );

  assert.equal(
    matchesPropertyRequestDiscoverFilters(baseRequest, {
      q: null,
      intent: null,
      marketCode: null,
      propertyType: null,
      bedrooms: null,
      moveTimeline: null,
      budgetMin: 400000,
      budgetMax: null,
      status: null,
    }),
    false
  );
});

void test("published status helper keeps draft and removed out of published lifecycle", () => {
  assert.equal(isPropertyRequestPublishedStatus("draft"), false);
  assert.equal(isPropertyRequestPublishedStatus("removed"), false);
  assert.equal(isPropertyRequestPublishedStatus("open"), true);
  assert.equal(isPropertyRequestPublishedStatus("matched"), true);
});

void test("owner write helper keeps phase 2 actions within draft open and closed", () => {
  assert.equal(canOwnerWritePropertyRequestStatus("draft"), true);
  assert.equal(canOwnerWritePropertyRequestStatus("open"), true);
  assert.equal(canOwnerWritePropertyRequestStatus("closed"), true);
  assert.equal(canOwnerWritePropertyRequestStatus("matched"), false);
});

void test("lifecycle date helper clears draft and preserves publish timestamps for open and closed", () => {
  const now = new Date("2026-03-16T10:00:00.000Z");
  assert.deepEqual(
    resolvePropertyRequestLifecycleDates({
      nextStatus: "draft",
      currentPublishedAt: "2026-03-01T10:00:00.000Z",
      currentExpiresAt: "2026-03-31T10:00:00.000Z",
      now,
    }),
    { publishedAt: null, expiresAt: null }
  );

  assert.deepEqual(
    resolvePropertyRequestLifecycleDates({
      nextStatus: "open",
      currentPublishedAt: "2026-03-01T10:00:00.000Z",
      currentExpiresAt: "2026-03-31T10:00:00.000Z",
      now,
    }),
    {
      publishedAt: "2026-03-01T10:00:00.000Z",
      expiresAt: "2026-03-31T10:00:00.000Z",
    }
  );

  const closedFresh = resolvePropertyRequestLifecycleDates({
    nextStatus: "closed",
    currentPublishedAt: null,
    currentExpiresAt: null,
    now,
  });
  assert.equal(closedFresh.publishedAt, now.toISOString());
  assert.match(closedFresh.expiresAt ?? "", /^2026-04-15T10:00:00.000Z$/);
});

void test("labels and location summaries stay human-readable", () => {
  assert.equal(getPropertyRequestIntentLabel("shortlet"), "Shortlet");
  assert.equal(getPropertyRequestMoveTimelineLabel("within_30_days"), "Within 30 days");
  assert.equal(getPropertyRequestMoveTimelineLabel(null), "Flexible");
  assert.equal(getPropertyRequestStatusLabel("closed"), "Closed");
  assert.equal(
    getPropertyRequestLocationSummary({ city: "Lagos", area: "Lekki", locationText: null }),
    "Lekki, Lagos"
  );
  assert.equal(
    getPropertyRequestLocationSummary({ city: null, area: null, locationText: "Near Yaba Tech" }),
    "Near Yaba Tech"
  );
});
