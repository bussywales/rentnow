import test from "node:test";
import assert from "node:assert/strict";

import { buildListingEntitlementIdempotencyKey } from "@/lib/billing/listing-publish-entitlement.server";

void test("renewal idempotency keys are stable for the same expired visibility cycle", () => {
  const first = buildListingEntitlementIdempotencyKey({
    context: "renewal",
    listingId: "listing-1",
    listingStatus: "expired",
    expiresAt: "2026-04-01T00:00:00.000Z",
  });
  const second = buildListingEntitlementIdempotencyKey({
    context: "renewal",
    listingId: "listing-1",
    listingStatus: "expired",
    expiresAt: "2026-04-01T00:00:00.000Z",
  });
  const nextCycle = buildListingEntitlementIdempotencyKey({
    context: "renewal",
    listingId: "listing-1",
    listingStatus: "expired",
    expiresAt: "2026-05-01T00:00:00.000Z",
  });

  assert.equal(first, second);
  assert.notEqual(first, nextCycle);
});

void test("reactivation idempotency keys rotate when a listing enters a new paused cycle", () => {
  const first = buildListingEntitlementIdempotencyKey({
    context: "reactivation",
    listingId: "listing-1",
    listingStatus: "paused_owner",
    pausedAt: "2026-04-10T00:00:00.000Z",
  });
  const second = buildListingEntitlementIdempotencyKey({
    context: "reactivation",
    listingId: "listing-1",
    listingStatus: "paused_owner",
    pausedAt: "2026-04-10T00:00:00.000Z",
  });
  const nextPause = buildListingEntitlementIdempotencyKey({
    context: "reactivation",
    listingId: "listing-1",
    listingStatus: "paused_owner",
    pausedAt: "2026-04-12T00:00:00.000Z",
  });

  assert.equal(first, second);
  assert.notEqual(first, nextPause);
});

void test("submission idempotency keys stay stable until the listing status cycle changes", () => {
  const first = buildListingEntitlementIdempotencyKey({
    context: "submission",
    listingId: "listing-1",
    listingStatus: "draft",
    statusUpdatedAt: "2026-04-10T00:00:00.000Z",
  });
  const second = buildListingEntitlementIdempotencyKey({
    context: "submission",
    listingId: "listing-1",
    listingStatus: "draft",
    statusUpdatedAt: "2026-04-10T00:00:00.000Z",
  });
  const afterReview = buildListingEntitlementIdempotencyKey({
    context: "submission",
    listingId: "listing-1",
    listingStatus: "changes_requested",
    statusUpdatedAt: "2026-04-11T00:00:00.000Z",
  });

  assert.equal(first, second);
  assert.notEqual(first, afterReview);
});
