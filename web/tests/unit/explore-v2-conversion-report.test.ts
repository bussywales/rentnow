import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExploreV2ConversionCsv,
  buildExploreV2ConversionReport,
  resolveExploreV2ConversionQuery,
  type ExploreV2ConversionRow,
} from "@/lib/explore/explore-v2-conversion-report";

void test("explore v2 conversion query defaults to last 7 days and all filters", () => {
  const query = resolveExploreV2ConversionQuery({
    now: new Date("2026-03-06T12:00:00.000Z"),
  });

  assert.equal(query.range.startDate, "2026-02-28");
  assert.equal(query.range.endDate, "2026-03-06");
  assert.equal(query.market, "ALL");
  assert.equal(query.intent, "ALL");
  assert.equal(query.format, "json");
});

void test("explore v2 conversion report aggregates totals and rates", () => {
  const rows: ExploreV2ConversionRow[] = [
    {
      created_at: "2026-03-05T09:00:00.000Z",
      event_name: "explore_v2_cta_sheet_opened",
      listing_id: "l-1",
      market_code: "NG",
      intent_type: "shortlet",
    },
    {
      created_at: "2026-03-05T09:00:01.000Z",
      event_name: "explore_v2_cta_primary_clicked",
      listing_id: "l-1",
      market_code: "NG",
      intent_type: "shortlet",
    },
    {
      created_at: "2026-03-05T09:00:02.000Z",
      event_name: "explore_v2_cta_share_clicked",
      listing_id: "l-1",
      market_code: "NG",
      intent_type: "shortlet",
    },
    {
      created_at: "2026-03-06T10:00:00.000Z",
      event_name: "explore_v2_cta_sheet_opened",
      listing_id: "l-2",
      market_code: "GB",
      intent_type: "rent",
    },
    {
      created_at: "2026-03-06T10:00:01.000Z",
      event_name: "explore_v2_cta_view_details_clicked",
      listing_id: "l-2",
      market_code: "GB",
      intent_type: "rent",
    },
  ];

  const report = buildExploreV2ConversionReport({
    rows,
    range: {
      startIso: "2026-03-05T00:00:00.000Z",
      endIso: "2026-03-06T23:59:59.999Z",
      startDate: "2026-03-05",
      endDate: "2026-03-06",
      label: "fixture",
    },
    market: "ALL",
    intent: "ALL",
  });

  assert.equal(report.totals.sheet_opened, 2);
  assert.equal(report.totals.primary_clicked, 1);
  assert.equal(report.totals.view_details_clicked, 1);
  assert.equal(report.totals.share_clicked, 1);
  assert.equal(report.rates.primary_per_open, 50);
  assert.equal(report.rates.view_details_per_open, 50);
  assert.equal(report.rates.share_per_open, 50);

  const day1 = report.by_day.find((row) => row.date === "2026-03-05");
  const day2 = report.by_day.find((row) => row.date === "2026-03-06");
  assert.equal(day1?.sheet_opened, 1);
  assert.equal(day2?.sheet_opened, 1);
});

void test("explore v2 conversion csv groups by day, market, intent, event", () => {
  const rows: ExploreV2ConversionRow[] = [
    {
      created_at: "2026-03-05T09:00:00.000Z",
      event_name: "explore_v2_cta_sheet_opened",
      listing_id: "l-1",
      market_code: "NG",
      intent_type: "shortlet",
    },
    {
      created_at: "2026-03-05T10:00:00.000Z",
      event_name: "explore_v2_cta_sheet_opened",
      listing_id: "l-2",
      market_code: "NG",
      intent_type: "shortlet",
    },
  ];

  const csv = buildExploreV2ConversionCsv(rows);
  assert.match(csv, /^date,market,intent,event_name,count/m);
  assert.match(csv, /2026-03-05,NG,shortlet,explore_v2_cta_sheet_opened,2/);
});
