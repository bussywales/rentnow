import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  getAdminReferralCashoutsResponse,
  type AdminReferralCashoutsRouteDeps,
} from "@/app/api/admin/referrals/cashouts/route";

const makeRequest = () =>
  new NextRequest("http://localhost/api/admin/referrals/cashouts", {
    method: "GET",
  });

const makeBaseDeps = (): AdminReferralCashoutsRouteDeps => ({
  requireRole: async () =>
    ({
      ok: true,
      supabase: {} as never,
      user: { id: "admin-1" } as User,
      role: "admin",
    }) as Awaited<ReturnType<AdminReferralCashoutsRouteDeps["requireRole"]>>,
  hasServiceRoleEnv: () => true,
  createServiceRoleClient: () => ({}) as never,
  parseAdminCashoutQueueFilters: () => ({ status: "all", risk: "any", timeframe: "30d", limit: 10 }),
  fetchAdminCashoutQueue: async () => [],
  evaluateCashoutRisk: async () => ({
    risk_level: "none",
    risk_flags: [],
    supporting_stats: {
      captures_1h: 0,
      captures_24h: 0,
      distinct_ip_hash_24h: 0,
      distinct_ua_hash_24h: 0,
      geo_mismatch_count_24h: 0,
      deep_referrals_30d: 0,
      max_depth_30d: 0,
    },
  }),
  validateCashoutActionTransition: () => ({ ok: true }),
});

void test("cashouts admin route blocks non-admin caller", async () => {
  const deps = makeBaseDeps();
  deps.requireRole = async () =>
    ({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }) as Awaited<ReturnType<AdminReferralCashoutsRouteDeps["requireRole"]>>;

  const response = await getAdminReferralCashoutsResponse(makeRequest(), deps);
  assert.equal(response.status, 403);
});

void test("cashouts admin route requires service role env", async () => {
  const deps = makeBaseDeps();
  deps.hasServiceRoleEnv = () => false;

  const response = await getAdminReferralCashoutsResponse(makeRequest(), deps);
  assert.equal(response.status, 503);
});
