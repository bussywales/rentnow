import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTION_THRESHOLDS,
  resolveInsightsActions,
  type ListingActionInput,
  type SupplyGap,
} from "@/lib/admin/insights-actions.server";

const now = new Date("2026-02-04T10:00:00.000Z");

const baseListing: ListingActionInput = {
  id: "listing-1",
  title: "Sunset Flat",
  city: "Lagos",
  status: "live",
  is_featured: false,
  featured_until: null,
  featured_rank: null,
  paused_at: null,
  views_range: ACTION_THRESHOLDS.highViews + 5,
  saves_range: 0,
  enquiries_range: 0,
  pre_pause_views: 0,
  pre_pause_enquiries: 0,
  paused_views: 0,
};

void test("resolveInsightsActions returns expected action types", () => {
  const listings: ListingActionInput[] = [
    baseListing,
    {
      ...baseListing,
      id: "listing-2",
      status: "paused_owner",
      paused_at: now.toISOString(),
      pre_pause_views: 5,
      paused_views: 3,
      is_featured: false,
    },
    {
      ...baseListing,
      id: "listing-3",
      is_featured: true,
      featured_until: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      featured_rank: 1,
      views_range: 0,
    },
  ];

  const supplyGaps: SupplyGap[] = [
    { city: "Abuja", views: 120, liveListings: 4, viewsPerListing: 30 },
  ];

  const actions = resolveInsightsActions({
    listings,
    supplyGaps,
    rangeKey: "7d",
    now,
  });

  const types = actions.map((action) => action.type);
  assert.ok(types.includes("LOW_VISIBILITY"));
  assert.ok(types.includes("MISSED_DEMAND"));
  assert.ok(types.includes("FEATURED_EXPIRING"));
  assert.ok(types.includes("SUPPLY_GAP"));
});

void test("resolveInsightsActions respects thresholds", () => {
  const actions = resolveInsightsActions({
    listings: [
      {
        ...baseListing,
        id: "listing-4",
        views_range: ACTION_THRESHOLDS.highViews - 1,
        enquiries_range: 0,
      },
    ],
    supplyGaps: [],
    rangeKey: "7d",
    now,
  });

  assert.equal(actions.find((action) => action.type === "LOW_VISIBILITY"), undefined);
});

void test("resolveInsightsActions returns empty when no inputs", () => {
  const actions = resolveInsightsActions({
    listings: [],
    supplyGaps: [],
    rangeKey: "7d",
    now,
  });
  assert.equal(actions.length, 0);
});
