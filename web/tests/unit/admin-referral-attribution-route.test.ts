import test from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  getAdminReferralAttributionResponse,
  type AdminReferralAttributionRouteDeps,
} from "@/app/api/admin/referrals/attribution/route";

const makeBaseDeps = (capture: { input: Record<string, unknown> | null }): AdminReferralAttributionRouteDeps => ({
  requireRole: async () =>
    ({
      ok: true,
      supabase: {} as never,
      user: { id: "admin-1" } as User,
      role: "admin",
    }) as Awaited<ReturnType<AdminReferralAttributionRouteDeps["requireRole"]>>,
  hasServiceRoleEnv: () => true,
  createServiceRoleClient: () => ({}) as never,
  getAdminReferralAttributionOverview: async (input) => {
    capture.input = input as unknown as Record<string, unknown>;
    return {
      totals: { clicks: 0, captures: 0 },
      capturesByChannel: [],
      campaigns: [],
      topCampaigns: [],
      anomalies: { ipAttributionClusters: [], deepChains: [] },
    };
  },
});

void test("admin attribution API forwards referrer and date range filters", async () => {
  const capture = { input: null as Record<string, unknown> | null };
  const request = new Request(
    "http://localhost/api/admin/referrals/attribution?window=7&referrer=00000000-0000-0000-0000-000000000123&from=2026-01-01&to=2026-01-14&utm_source=whatsapp&campaignId=00000000-0000-0000-0000-000000000999"
  );
  const response = await getAdminReferralAttributionResponse(request, makeBaseDeps(capture));

  assert.equal(response.status, 200);
  assert.equal(capture.input?.referrerUserId, "00000000-0000-0000-0000-000000000123");
  assert.equal(capture.input?.fromDate, "2026-01-01");
  assert.equal(capture.input?.toDate, "2026-01-14");
  assert.equal(capture.input?.utmSource, "whatsapp");
  assert.equal(capture.input?.campaignId, "00000000-0000-0000-0000-000000000999");
  assert.equal(capture.input?.timeframeDays, 7);
});

void test("admin attribution API rejects non-admin access", async () => {
  const capture = { input: null as Record<string, unknown> | null };
  const deps = makeBaseDeps(capture);
  deps.requireRole = async () =>
    ({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }) as Awaited<ReturnType<AdminReferralAttributionRouteDeps["requireRole"]>>;

  const response = await getAdminReferralAttributionResponse(
    new Request("http://localhost/api/admin/referrals/attribution"),
    deps
  );

  assert.equal(response.status, 403);
});

