import test from "node:test";
import assert from "node:assert/strict";
import { getLastUpdatedDate, type DashboardListing } from "@/lib/properties/host-dashboard";
import { formatRelativeTime } from "@/lib/date/relative-time";

const now = new Date("2024-01-02T00:00:00.000Z");
const baseListing: DashboardListing = {
  id: "id",
  owner_id: "owner",
  title: "Title",
  city: "City",
  rental_type: "long_term",
  price: 100,
  currency: "USD",
  bedrooms: 1,
  bathrooms: 1,
  furnished: false,
  readiness: { score: 0, tier: "Excellent", issues: [] },
};

void test("prefers updated_at then created_at", () => {
  const listing: DashboardListing = {
    ...baseListing,
    updated_at: "2024-01-01T23:00:00.000Z",
    created_at: "2023-12-31T00:00:00.000Z",
  };
  const fallback: DashboardListing = {
    ...baseListing,
    id: "id-2",
    updated_at: null,
    created_at: "2023-12-30T00:00:00.000Z",
  };

  assert.equal(getLastUpdatedDate(listing), "2024-01-01T23:00:00.000Z");
  assert.equal(getLastUpdatedDate(fallback), "2023-12-30T00:00:00.000Z");
});

void test("formats relative time for last updated", () => {
  const listing: DashboardListing = {
    ...baseListing,
    updated_at: "2024-01-01T23:00:00.000Z",
    created_at: "2023-12-31T00:00:00.000Z",
  };
  const lastUpdated = getLastUpdatedDate(listing);
  assert.equal(formatRelativeTime(lastUpdated, now), "1 hour ago");
});
