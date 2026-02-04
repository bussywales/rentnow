import test from "node:test";
import assert from "node:assert/strict";
import {
  computeTenantFunnel,
  computeHostFunnel,
  filterEventsByRange,
  type TenantSignal,
} from "@/lib/admin/revenue-funnels.server";
import type { InsightsRange } from "@/lib/admin/insights";
import type { PropertyEventRow } from "@/lib/analytics/property-events";

void test("computeTenantFunnel aggregates tenant steps", () => {
  const visitors = new Set(["sess-1", "sess-2", "sess-3"]);
  const signals = new Map<string, TenantSignal>([
    ["tenant-1", { viewed: true, saves: 1, enquired: false }],
    ["tenant-2", { viewed: true, saves: 2, enquired: false }],
    ["tenant-3", { viewed: true, saves: 0, enquired: true }],
  ]);
  const eligible = new Set(["tenant-1", "tenant-2"]);

  const steps = computeTenantFunnel({
    visitors,
    signupsCount: eligible.size,
    signals,
    eligibleTenantIds: eligible,
  });

  assert.equal(steps[0].count, 3);
  assert.equal(steps[1].count, 2);
  assert.equal(steps[2].count, 2);
  assert.equal(steps[3].count, 1);
  assert.equal(steps[4].count, 0);
});

void test("computeHostFunnel aggregates host steps", () => {
  const sets = {
    activated: new Set(["h1", "h2", "h3"]),
    live: new Set(["h1", "h2"]),
    highIntent: new Set(["h1"]),
    monetisable: new Set(["h1"]),
  };

  const { steps } = computeHostFunnel({
    sets,
    signupsCount: 4,
    highIntentThreshold: 12,
  });

  assert.equal(steps[0].count, 4);
  assert.equal(steps[1].count, 3);
  assert.equal(steps[2].count, 2);
  assert.equal(steps[3].count, 1);
  assert.equal(steps[4].count, 1);
});

void test("filterEventsByRange respects range boundaries", () => {
  const range: InsightsRange = {
    key: "7d",
    label: "Last 7 days",
    days: 7,
    start: "2026-02-01T00:00:00.000Z",
    end: "2026-02-08T00:00:00.000Z",
  };

  const rows: PropertyEventRow[] = [
    { property_id: "p1", event_type: "property_view", occurred_at: "2026-02-02T00:00:00.000Z" },
    { property_id: "p1", event_type: "property_view", occurred_at: "2026-01-30T00:00:00.000Z" },
  ];

  const filtered = filterEventsByRange(rows, range);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.occurred_at, "2026-02-02T00:00:00.000Z");
});
