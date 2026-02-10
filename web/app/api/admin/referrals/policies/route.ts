import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import {
  REFERRAL_CASHOUT_ELIGIBLE_SOURCES,
  REFERRAL_CASHOUT_RATE_MODES,
} from "@/lib/referrals/cashout";
import {
  REFERRAL_POLICY_SELECT,
  upsertReferralJurisdictionPolicy,
} from "@/lib/referrals/policies.server";

const routeLabel = "/api/admin/referrals/policies";

const cashoutRateModeSchema = z.enum(REFERRAL_CASHOUT_RATE_MODES);
const cashoutEligibleSourceSchema = z.enum(REFERRAL_CASHOUT_ELIGIBLE_SOURCES);

const createSchema = z.object({
  country_code: z.string().min(2).max(3),
  payouts_enabled: z.boolean().optional(),
  conversion_enabled: z.boolean().optional(),
  credit_to_cash_rate: z.number().min(0).optional(),
  cashout_rate_mode: cashoutRateModeSchema.optional(),
  cashout_rate_amount_minor: z.number().int().min(0).nullable().optional(),
  cashout_rate_percent: z.number().min(0).nullable().optional(),
  cashout_eligible_sources: z.array(cashoutEligibleSourceSchema).optional(),
  currency: z.string().min(1).max(10).optional(),
  min_cashout_credits: z.number().int().min(0).optional(),
  monthly_cashout_cap_amount: z.number().min(0).optional(),
  requires_manual_approval: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const adminClient = createServiceRoleClient() as unknown as UntypedAdminClient;
  const { data, error } = await adminClient
    .from("referral_jurisdiction_policies")
    .select(REFERRAL_POLICY_SELECT)
    .order("country_code", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ policies: data ?? [] });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  const adminClient = createServiceRoleClient() as unknown as UntypedAdminClient;
  const now = new Date().toISOString();
  const { data, error } = await upsertReferralJurisdictionPolicy(
    adminClient,
    parsed.data,
    now
  );

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Unable to save policy" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, policy: data });
}
