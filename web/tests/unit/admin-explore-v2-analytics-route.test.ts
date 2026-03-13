import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  getAdminExploreV2AnalyticsResponse,
  type AdminExploreV2AnalyticsDeps,
} from "@/app/api/admin/analytics/explore-v2/route";
import {
  buildExploreV2ConversionCsv,
  buildExploreV2ConversionReport,
  resolveExploreV2ConversionQuery,
  type ExploreV2ConversionRow,
} from "@/lib/explore/explore-v2-conversion-report";

function makeRequest(query = "") {
  const suffix = query ? `?${query}` : "";
  return new NextRequest(`http://localhost/api/admin/analytics/explore-v2${suffix}`, {
    method: "GET",
  });
}

function createBaseDeps(rows: ExploreV2ConversionRow[]): AdminExploreV2AnalyticsDeps {
  return {
    requireRole: async () =>
      ({
        ok: true,
        role: "admin",
        user: { id: "admin-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<AdminExploreV2AnalyticsDeps["requireRole"]>>,
    hasServiceRoleEnv: () => false,
    createServiceRoleClient: () => ({}) as never,
    createServerSupabaseClient: async () => ({}) as never,
    resolveExploreV2ConversionQuery,
    fetchExploreV2ConversionRows: async () => rows,
    buildExploreV2ConversionReport,
    buildExploreV2ConversionCsv,
  };
}

void test("admin explore v2 analytics route preserves admin auth failures", async () => {
  const deps = createBaseDeps([]);
  deps.requireRole = async () =>
    ({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }) as Awaited<ReturnType<AdminExploreV2AnalyticsDeps["requireRole"]>>;

  const response = await getAdminExploreV2AnalyticsResponse(makeRequest(), deps);
  assert.equal(response.status, 403);
});

void test("admin explore v2 analytics route aggregates metrics and forwards filters", async () => {
  const seedRows: ExploreV2ConversionRow[] = [
    {
      created_at: "2026-03-05T09:00:00.000Z",
      event_name: "explore_v2_cta_sheet_opened",
      listing_id: "l-1",
      market_code: "NG",
      intent_type: "shortlet",
      trust_cue_variant: "instant_confirmation",
      cta_copy_variant: "clarity",
    },
    {
      created_at: "2026-03-05T09:00:01.000Z",
      event_name: "explore_v2_cta_primary_clicked",
      listing_id: "l-1",
      market_code: "NG",
      intent_type: "shortlet",
      trust_cue_variant: "instant_confirmation",
      cta_copy_variant: "clarity",
    },
    {
      created_at: "2026-03-05T09:00:02.000Z",
      event_name: "explore_v2_cta_share_clicked",
      listing_id: "l-1",
      market_code: "NG",
      intent_type: "shortlet",
    },
    {
      created_at: "2026-03-05T09:30:00.000Z",
      event_name: "explore_v2_cta_sheet_opened",
      listing_id: "l-2",
      market_code: "GB",
      intent_type: "rent",
    },
  ];

  const deps = createBaseDeps(seedRows);
  let capturedMarket: string | null = null;
  let capturedIntent: string | null = null;
  deps.fetchExploreV2ConversionRows = async ({ market, intent }) => {
    capturedMarket = market;
    capturedIntent = intent;
    return seedRows.filter(
      (row) =>
        (market === "ALL" || row.market_code === market) &&
        (intent === "ALL" || row.intent_type === intent)
    );
  };

  const response = await getAdminExploreV2AnalyticsResponse(
    makeRequest("start=2026-03-05&end=2026-03-05&market=NG&intent=shortlet"),
    deps
  );
  const body = (await response.json()) as {
    ok: boolean;
    totals: { sheet_opened: number; primary_clicked: number; share_clicked: number };
    market: string;
    intent: string;
    by_trust_cue_variant: Array<{
      key: string;
      sheet_opened: number;
      primary_clicked: number;
      primary_per_open: number | null;
      view_details_per_open: number | null;
    }>;
    by_cta_copy_variant: Array<{
      key: string;
      sheet_opened: number;
      primary_clicked: number;
      primary_per_open: number | null;
      view_details_per_open: number | null;
    }>;
  };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(capturedMarket, "NG");
  assert.equal(capturedIntent, "shortlet");
  assert.equal(body.market, "NG");
  assert.equal(body.intent, "shortlet");
  assert.equal(body.totals.sheet_opened, 1);
  assert.equal(body.totals.primary_clicked, 1);
  assert.equal(body.totals.share_clicked, 1);
  const instantRow = body.by_trust_cue_variant.find((row) => row.key === "instant_confirmation");
  assert.equal(instantRow?.sheet_opened, 1);
  assert.equal(instantRow?.primary_clicked, 1);
  assert.equal(instantRow?.primary_per_open, 100);
  assert.equal(instantRow?.view_details_per_open, 0);
  const clarityRow = body.by_cta_copy_variant.find((row) => row.key === "clarity");
  assert.equal(clarityRow?.sheet_opened, 1);
  assert.equal(clarityRow?.primary_clicked, 1);
  assert.equal(clarityRow?.primary_per_open, 100);
  const unknownRow = body.by_cta_copy_variant.find((row) => row.key === "unknown");
  assert.equal(unknownRow?.sheet_opened, 0);
});

void test("admin explore v2 analytics route can return CSV export", async () => {
  const deps = createBaseDeps([
    {
      created_at: "2026-03-05T09:00:00.000Z",
      event_name: "explore_v2_cta_sheet_opened",
      listing_id: "l-1",
      market_code: "NG",
      intent_type: "shortlet",
      trust_cue_variant: "instant_confirmation",
      cta_copy_variant: "action",
    },
    {
      created_at: "2026-03-05T09:05:00.000Z",
      event_name: "explore_v2_cta_sheet_opened",
      listing_id: "l-2",
      market_code: "NG",
      intent_type: "shortlet",
    },
  ]);

  const response = await getAdminExploreV2AnalyticsResponse(
    makeRequest("start=2026-03-05&end=2026-03-05&format=csv"),
    deps
  );
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/csv/);
  assert.match(body, /^date,market,intent,trust_cue_variant,cta_copy_variant,event_name,count/m);
  assert.match(body, /2026-03-05,NG,shortlet,instant_confirmation,action,explore_v2_cta_sheet_opened,1/);
  assert.match(body, /2026-03-05,NG,shortlet,unknown,unknown,explore_v2_cta_sheet_opened,1/);
});
