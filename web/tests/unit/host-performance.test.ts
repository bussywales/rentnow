import test from "node:test";
import assert from "node:assert/strict";
import {
  computeHostPerformanceRows,
  type HostPerformanceListing,
} from "@/lib/analytics/host-performance.server";
import type { PropertyEventRow } from "@/lib/analytics/property-events";

const now = new Date("2026-02-04T12:00:00Z");

void test("computeHostPerformanceRows aggregates events per listing", () => {
  const listings: HostPerformanceListing[] = [
    {
      id: "prop-1",
      owner_id: "owner-1",
      title: "Alpha",
      city: "Lagos",
      status: "live",
      listing_intent: "rent",
      approved_at: "2026-01-25T12:00:00Z",
      created_at: "2026-01-20T12:00:00Z",
    },
  ];

  const events: PropertyEventRow[] = [
    { property_id: "prop-1", event_type: "property_view", occurred_at: "2026-02-03T12:00:00Z" },
    { property_id: "prop-1", event_type: "property_view", occurred_at: "2026-02-03T12:05:00Z" },
    { property_id: "prop-1", event_type: "save_toggle", meta: { action: "save" }, occurred_at: "2026-02-03T12:10:00Z" },
    { property_id: "prop-1", event_type: "save_toggle", meta: { action: "unsave" }, occurred_at: "2026-02-03T12:12:00Z" },
    { property_id: "prop-1", event_type: "lead_created", occurred_at: "2026-02-03T12:20:00Z" },
    { property_id: "prop-1", event_type: "viewing_requested", occurred_at: "2026-02-03T12:30:00Z" },
  ];

  const [row] = computeHostPerformanceRows({ listings, events, now, rangeDays: 30 });
  assert.equal(row.views, 2);
  assert.equal(row.saves, 0);
  assert.equal(row.enquiries, 2);
  assert.equal(row.daysLive, 10);
  assert.equal(Number(row.leadRate.toFixed(2)), 1);
});

void test("computeHostPerformanceRows respects range filters", () => {
  const listings: HostPerformanceListing[] = [
    { id: "prop-2", owner_id: "owner-1", title: "Bravo", city: "Lagos", status: "live" },
  ];
  const events: PropertyEventRow[] = [
    { property_id: "prop-2", event_type: "property_view", occurred_at: "2026-01-01T12:00:00Z" },
    { property_id: "prop-2", event_type: "property_view", occurred_at: "2026-02-02T12:00:00Z" },
  ];

  const [row] = computeHostPerformanceRows({ listings, events, now, rangeDays: 7 });
  assert.equal(row.views, 1);
});

void test("computeHostPerformanceRows ignores events for other listings", () => {
  const listings: HostPerformanceListing[] = [
    { id: "prop-3", owner_id: "owner-1", title: "Charlie", city: "Abuja", status: "draft" },
  ];
  const events: PropertyEventRow[] = [
    { property_id: "prop-x", event_type: "property_view", occurred_at: "2026-02-03T12:00:00Z" },
  ];

  const [row] = computeHostPerformanceRows({ listings, events, now, rangeDays: 30 });
  assert.equal(row.views, 0);
  assert.equal(row.enquiries, 0);
});
