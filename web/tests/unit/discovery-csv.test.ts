import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBrokenRoutesCsv,
  buildCoverageSummaryCsv,
  buildInvalidEntriesCsv,
} from "@/lib/discovery/diagnostics/csv";
import type { DiscoveryCoverageSummary } from "@/lib/discovery/diagnostics/coverage";
import type { BrokenRouteIssue } from "@/lib/discovery/diagnostics/broken-routes";
import type { HealthIssue } from "@/lib/admin/discovery-health";

void test("coverage CSV output includes stable headers and values", () => {
  const summary: DiscoveryCoverageSummary = {
    rows: [
      {
        market: "NG",
        surface: "HOME_FEATURED",
        threshold: 6,
        availableCount: 8,
        marketSpecificCount: 5,
        coverageScore: 100,
        deficit: 0,
        atRisk: false,
      },
    ],
    byMarketScore: { GLOBAL: 0, NG: 100, CA: 0, GB: 0, US: 0 },
    bySurfaceScore: { HOME_FEATURED: 100, SHORTLETS_FEATURED: 0, PROPERTIES_FEATURED: 0, COLLECTIONS: 0 },
    overallCoverageScore: 25,
    topRisks: [],
  };

  const csv = buildCoverageSummaryCsv(summary);
  const lines = csv.split("\n");
  assert.equal(
    lines[0],
    "market,surface,threshold,available_count,market_specific_count,coverage_score,deficit,at_risk"
  );
  assert.equal(lines[1], "NG,HOME_FEATURED,6,8,5,100,0,false");
});

void test("invalid and broken CSV outputs escape content correctly", () => {
  const invalidEntries: HealthIssue[] = [
    {
      source: "discovery",
      id: "item-1",
      reasonCodes: ["MISSING_PARAMS"],
      details: 'missing "params", expected key/value',
    },
  ];

  const brokenIssues: BrokenRouteIssue[] = [
    {
      source: "collections",
      id: "weekend-getaways",
      routeLabel: "collection_results",
      href: "/shortlets?where=Lagos",
      reasonCode: "MISSING_REQUIRED_PARAM",
      details: "shortlets route missing guests param",
    },
  ];

  const invalidCsv = buildInvalidEntriesCsv(invalidEntries);
  assert.ok(invalidCsv.includes('"missing ""params"", expected key/value"'));

  const brokenCsv = buildBrokenRoutesCsv(brokenIssues);
  assert.ok(
    brokenCsv.startsWith("source,id,route_label,reason_code,href,details\ncollections,weekend-getaways")
  );
});
