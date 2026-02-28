import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  buildExploreAnalyticsCounters,
  resolveExploreAnalyticsRange,
  toExploreAnalyticsEvents,
  type ExploreAnalyticsRow,
} from "@/lib/explore/explore-analytics.server";
import { buildExploreAnalyticsCsv } from "@/lib/explore/explore-analytics-export";

void test("explore analytics range resolver supports explicit day", () => {
  const range = resolveExploreAnalyticsRange({ date: "2026-02-28" });
  assert.equal(range.startDate, "2026-02-28");
  assert.equal(range.endDate, "2026-02-28");
  assert.equal(range.startIso, "2026-02-28T00:00:00.000Z");
  assert.equal(range.endIso, "2026-02-28T23:59:59.999Z");
});

void test("explore analytics range resolver defaults to last 7 days", () => {
  const range = resolveExploreAnalyticsRange({
    now: new Date("2026-02-28T12:00:00.000Z"),
  });
  assert.equal(range.startDate, "2026-02-22");
  assert.equal(range.endDate, "2026-02-28");
});

void test("explore analytics counters aggregate expected funnel stages", () => {
  const rows: ExploreAnalyticsRow[] = [
    {
      created_at: "2026-02-28T10:00:00.000Z",
      event_name: "explore_view",
      session_id: "s1",
      listing_id: null,
      market_code: "GB",
      intent_type: null,
      slide_index: null,
      feed_size: null,
    },
    {
      created_at: "2026-02-28T10:00:01.000Z",
      event_name: "explore_swipe",
      session_id: "s1",
      listing_id: null,
      market_code: "GB",
      intent_type: null,
      slide_index: 1,
      feed_size: 20,
    },
    {
      created_at: "2026-02-28T10:00:02.000Z",
      event_name: "explore_submit_request_attempt",
      session_id: "s1",
      listing_id: "11111111-1111-1111-1111-111111111111",
      market_code: "GB",
      intent_type: "rent",
      slide_index: 1,
      feed_size: 20,
    },
  ];

  const counters = buildExploreAnalyticsCounters(rows);
  assert.equal(counters.views, 1);
  assert.equal(counters.swipes, 1);
  assert.equal(counters.requestAttempts, 1);
});

void test("explore analytics export csv includes mapped server rows", () => {
  const rows: ExploreAnalyticsRow[] = [
    {
      created_at: "2026-02-28T10:00:00.000Z",
      event_name: "explore_open_details",
      session_id: "session-1",
      listing_id: "11111111-1111-1111-1111-111111111111",
      market_code: "US",
      intent_type: "buy",
      slide_index: 3,
      feed_size: 20,
    },
  ];
  const csv = buildExploreAnalyticsCsv(toExploreAnalyticsEvents(rows));
  assert.match(csv, /explore_open_details/);
  assert.match(csv, /session-1/);
  assert.match(csv, /US,buy,3,20/);
});

void test("admin explore export route is admin protected", () => {
  const sourcePath = path.join(
    process.cwd(),
    "app",
    "api",
    "admin",
    "analytics",
    "explore",
    "export",
    "route.ts"
  );
  const source = readFileSync(sourcePath, "utf8");
  assert.match(source, /roles:\s*\["admin"\]/);
  assert.match(source, /buildExploreAnalyticsCsv/);
});
