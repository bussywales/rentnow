import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAlerts,
  computeEmergingMarkets,
  computeListingFlags,
  calculateGrowthPct,
  type ListingHealthRow,
  type MarketPerformanceRow,
} from "@/lib/admin/insights-drilldowns";

void test("calculateGrowthPct handles new markets", () => {
  assert.equal(calculateGrowthPct(10, 0), 100);
  assert.equal(calculateGrowthPct(0, 0), null);
});

void test("computeListingFlags covers paused demand + zeroes", () => {
  const now = new Date();
  const row: ListingHealthRow = {
    id: "1",
    title: "Test",
    city: "Lagos",
    status: "paused_owner",
    updated_at: null,
    expires_at: new Date(now.getTime() + 3 * 86400000).toISOString(),
    paused_at: new Date(now.getTime() - 2 * 86400000).toISOString(),
    is_featured: false,
    featured_until: null,
    views_range: 0,
    views_7d: 1,
    leads_14d: 0,
    paused_views: 2,
    flags: [],
  };

  const flags = computeListingFlags(row, now);
  assert.ok(flags.includes("zero_views"));
  assert.ok(flags.includes("zero_enquiries"));
  assert.ok(flags.includes("paused_demand"));
  assert.ok(flags.includes("expiring_soon"));
});

void test("buildAlerts generates required alerts", () => {
  const listingRows: ListingHealthRow[] = [
    {
      id: "1",
      title: "A",
      city: "Lagos",
      status: "live",
      updated_at: null,
      expires_at: null,
      paused_at: null,
      is_featured: false,
      featured_until: null,
      views_range: 0,
      views_7d: 0,
      leads_14d: 0,
      paused_views: 0,
      flags: ["zero_views", "zero_enquiries"],
    },
  ];

  const alerts = buildAlerts({
    rangeKey: "7d",
    listingRows,
    featuredCtrCurrent: 5,
    featuredCtrPrevious: 10,
  });

  const ids = alerts.map((alert) => alert.id);
  assert.ok(ids.includes("zero-views"));
  assert.ok(ids.includes("zero-enquiries"));
  assert.ok(ids.includes("featured-drop"));
});

void test("computeEmergingMarkets sorts by growth", () => {
  const current = new Map<string, MarketPerformanceRow>([
    ["Lagos", { city: "Lagos", visitors: 10, views: 100, enquiries: 20, conversion: 20 }],
    ["Abuja", { city: "Abuja", visitors: 5, views: 30, enquiries: 5, conversion: 16.7 }],
  ]);
  const previous = new Map<string, MarketPerformanceRow>([
    ["Lagos", { city: "Lagos", visitors: 5, views: 50, enquiries: 10, conversion: 20 }],
    ["Abuja", { city: "Abuja", visitors: 5, views: 30, enquiries: 5, conversion: 16.7 }],
  ]);

  const emerging = computeEmergingMarkets(current, previous);
  assert.equal(emerging[0].city, "Lagos");
});
