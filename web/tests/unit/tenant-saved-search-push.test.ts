import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSavedSearchPushPayload,
  buildTenantPushDeliveryAttempt,
  matchPropertyToSavedSearch,
  shouldAttemptSavedSearchPush,
} from "../../lib/alerts/tenant-push-saved-search";
import type { Property, SavedSearch } from "../../lib/types";

const baseProperty: Property = {
  id: "prop-1",
  owner_id: "owner-1",
  title: "Bright 2 bedroom Apartment",
  city: "Lagos",
  rental_type: "long_term",
  price: 2500,
  currency: "USD",
  bedrooms: 2,
  bathrooms: 2,
  furnished: false,
};

const baseSearch: SavedSearch = {
  id: "search-1",
  user_id: "tenant-1",
  name: "Lagos 2-bed",
  query_params: {
    city: "Lagos",
    minPrice: 2000,
    maxPrice: 3000,
    bedrooms: 2,
    rentalType: "long_term",
  },
};

void test("matchPropertyToSavedSearch respects saved search filters", () => {
  assert.equal(matchPropertyToSavedSearch(baseProperty, baseSearch), true);

  const mismatched: SavedSearch = {
    ...baseSearch,
    query_params: { city: "Abuja" },
  };
  assert.equal(matchPropertyToSavedSearch(baseProperty, mismatched), false);
});

void test("buildSavedSearchPushPayload includes safe fields", () => {
  const payload = buildSavedSearchPushPayload({
    property: baseProperty,
    siteUrl: "https://example.com",
  });

  assert.equal(payload.type, "saved_search_match");
  assert.equal(payload.property_id, baseProperty.id);
  assert.equal(payload.city, "Lagos");
  assert.equal(payload.url, `https://example.com/properties/${baseProperty.id}`);
  assert.equal("search" in payload, false);
});

void test("shouldAttemptSavedSearchPush guards dedupe and subscriptions", () => {
  assert.equal(
    shouldAttemptSavedSearchPush({
      pushReady: true,
      subscriptionCount: 1,
      deduped: false,
    }),
    true
  );
  assert.equal(
    shouldAttemptSavedSearchPush({
      pushReady: true,
      subscriptionCount: 0,
      deduped: false,
    }),
    false
  );
  assert.equal(
    shouldAttemptSavedSearchPush({
      pushReady: true,
      subscriptionCount: 2,
      deduped: true,
    }),
    false
  );
});

void test("buildTenantPushDeliveryAttempt maps blocked outcomes", () => {
  const attempt = buildTenantPushDeliveryAttempt({
    outcome: {
      attempted: false,
      status: "skipped",
      error: "push_unavailable:not_configured",
      attemptedCount: 0,
      deliveredCount: 0,
      failedCount: 0,
    },
    propertyId: baseProperty.id,
    subscriptionCount: 0,
  });

  assert.equal(attempt.status, "blocked");
  assert.equal(attempt.reasonCode, "push_not_configured");
});

void test("buildTenantPushDeliveryAttempt maps delivered outcomes", () => {
  const attempt = buildTenantPushDeliveryAttempt({
    outcome: {
      attempted: true,
      status: "sent",
      attemptedCount: 2,
      deliveredCount: 2,
      failedCount: 0,
    },
    propertyId: baseProperty.id,
    subscriptionCount: 2,
  });

  assert.equal(attempt.status, "delivered");
  assert.equal(attempt.deliveredCount, 2);
  assert.equal(attempt.reasonCode, "saved_search_match");
});
