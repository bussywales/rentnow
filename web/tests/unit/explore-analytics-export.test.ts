import test from "node:test";
import assert from "node:assert/strict";
import { buildExploreAnalyticsCsv, EXPLORE_ANALYTICS_EXPORT_COLUMNS } from "@/lib/explore/explore-analytics-export";

void test("explore analytics export builds deterministic CSV headers and rows", () => {
  const csv = buildExploreAnalyticsCsv([
    {
      name: "explore_view",
      at: "2026-02-28T10:00:00.000Z",
      sessionId: "session-1",
      listingId: "listing-1",
      marketCode: "GB",
      intentType: "rent",
      index: 0,
      feedSize: 20,
      action: "open",
      result: "ok",
    },
  ]);

  const [header, row] = csv.split("\n");
  assert.equal(header, EXPLORE_ANALYTICS_EXPORT_COLUMNS.join(","));
  assert.match(row, /^2026-02-28T10:00:00.000Z,session-1,explore_view,listing-1,GB,rent,0,20,open,ok$/);
});

void test("explore analytics export safely escapes commas and quotes", () => {
  const csv = buildExploreAnalyticsCsv([
    {
      name: "explore_submit_request_fail",
      at: "2026-02-28T10:00:00.000Z",
      action: "send_request",
      result: 'http_400,"retry"',
    },
  ]);

  const lines = csv.split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[1] ?? "", /"http_400,""retry"""/);
});
