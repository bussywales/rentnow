import test from "node:test";
import assert from "node:assert/strict";
import type { InsightsRange } from "@/lib/admin/insights";
import type { PropertyEventRow } from "@/lib/analytics/property-events";
import {
  buildBoostCandidates,
  buildSupplyRecovery,
  buildUpsellTargets,
  filterEventsByRange,
} from "@/lib/admin/monetisation-opportunities.server";

const RANGE: InsightsRange = {
  key: "7d",
  label: "Last 7 days",
  days: 7,
  start: "2026-02-01T00:00:00.000Z",
  end: "2026-02-08T00:00:00.000Z",
};

void test("boost candidates exclude already-featured listings", () => {
  const now = new Date("2026-02-05T00:00:00.000Z");
  const listings = [
    {
      id: "l1",
      title: "Listing One",
      city: "Lagos",
      status: "live",
      owner_id: "host-1",
      is_featured: true,
      featured_until: "2026-03-01T00:00:00.000Z",
      metrics: { views: 10, saves: 3, enquiries: 1 },
      missedDemand: null,
    },
  ];

  const results = buildBoostCandidates({ listings, range: RANGE, now });
  assert.equal(results.length, 0);
});

void test("supply recovery includes paused listings with missed demand", () => {
  const listings = [
    {
      id: "l2",
      title: "Paused Listing",
      city: "Abuja",
      status: "paused_owner",
      owner_id: "host-2",
      is_featured: false,
      featured_until: null,
      metrics: { views: 12, saves: 2, enquiries: 0 },
      missedDemand: 18,
    },
  ];

  const results = buildSupplyRecovery({ listings, range: RANGE });
  assert.equal(results.length, 1);
  assert.equal(results[0]?.listing_id, "l2");
});

void test("upsell targets require multiple live listings and no featured usage", () => {
  const listings = [
    {
      id: "l3",
      title: "Live A",
      city: "Lagos",
      status: "live",
      owner_id: "host-3",
      is_featured: false,
      featured_until: null,
      metrics: { views: 60, saves: 2, enquiries: 3 },
      missedDemand: null,
    },
    {
      id: "l4",
      title: "Live B",
      city: "Lagos",
      status: "live",
      owner_id: "host-3",
      is_featured: false,
      featured_until: null,
      metrics: { views: 40, saves: 1, enquiries: 1 },
      missedDemand: null,
    },
  ];

  const revenueHosts = new Set(["host-3"]);
  const results = buildUpsellTargets({ listings, revenueHostIds: revenueHosts, range: RANGE });
  assert.equal(results.length, 1);
  assert.equal(results[0]?.host_id, "host-3");
});

void test("filterEventsByRange excludes events outside window", () => {
  const rows: PropertyEventRow[] = [
    {
      property_id: "p1",
      event_type: "property_view",
      occurred_at: "2026-02-02T00:00:00.000Z",
    },
    {
      property_id: "p1",
      event_type: "property_view",
      occurred_at: "2026-01-20T00:00:00.000Z",
    },
  ];

  const filtered = filterEventsByRange(rows, RANGE);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.occurred_at, "2026-02-02T00:00:00.000Z");
});
