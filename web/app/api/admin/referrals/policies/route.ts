import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import {
  DEFAULT_REFERRAL_POLICY,
  REFERRAL_CASHOUT_ELIGIBLE_SOURCES,
  REFERRAL_CASHOUT_RATE_MODES,
  majorCurrencyToMinor,
  minorCurrencyToMajor,
  normalizePolicyCountryCode,
} from "@/lib/referrals/cashout";

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

function normalizeEligibleSources(value: readonly string[] | undefined) {
  if (value === undefined) {
    return [...DEFAULT_REFERRAL_POLICY.cashout_eligible_sources];
  }
  const deduped = Array.from(
    new Set(
      value.filter((entry): entry is (typeof REFERRAL_CASHOUT_ELIGIBLE_SOURCES)[number] =>
        (REFERRAL_CASHOUT_ELIGIBLE_SOURCES as readonly string[]).includes(entry)
      )
    )
  );
  return deduped;
}

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
    .select(
      "id, country_code, payouts_enabled, conversion_enabled, credit_to_cash_rate, cashout_rate_mode, cashout_rate_amount_minor, cashout_rate_percent, cashout_eligible_sources, currency, min_cashout_credits, monthly_cashout_cap_amount, requires_manual_approval, updated_at"
    )
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
  const payload = parsed.data;
  const cashoutRateMode = payload.cashout_rate_mode ?? "fixed";
  const cashoutRateAmountMinor =
    payload.cashout_rate_amount_minor ??
    (payload.credit_to_cash_rate !== undefined
      ? majorCurrencyToMinor(payload.credit_to_cash_rate)
      : 0);
  const cashoutRatePercent =
    payload.cashout_rate_percent === undefined ? null : payload.cashout_rate_percent;
  const cashoutEligibleSources = normalizeEligibleSources(payload.cashout_eligible_sources);

  const { data, error } = await adminClient
    .from("referral_jurisdiction_policies")
    .upsert(
      {
        country_code: normalizePolicyCountryCode(payload.country_code),
        payouts_enabled: payload.payouts_enabled ?? false,
        conversion_enabled: payload.conversion_enabled ?? false,
        credit_to_cash_rate: minorCurrencyToMajor(cashoutRateAmountMinor),
        cashout_rate_mode: cashoutRateMode,
        cashout_rate_amount_minor: cashoutRateAmountMinor,
        cashout_rate_percent: cashoutRatePercent,
        cashout_eligible_sources: cashoutEligibleSources,
        currency: (payload.currency || "NGN").trim().toUpperCase(),
        min_cashout_credits: payload.min_cashout_credits ?? 0,
        monthly_cashout_cap_amount: payload.monthly_cashout_cap_amount ?? 0,
        requires_manual_approval: payload.requires_manual_approval ?? true,
        updated_at: now,
      },
      { onConflict: "country_code" }
    )
    .select(
      "id, country_code, payouts_enabled, conversion_enabled, credit_to_cash_rate, cashout_rate_mode, cashout_rate_amount_minor, cashout_rate_percent, cashout_eligible_sources, currency, min_cashout_credits, monthly_cashout_cap_amount, requires_manual_approval, updated_at"
    )
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Unable to save policy" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, policy: data });
}
