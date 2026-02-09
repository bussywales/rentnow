import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getUserJurisdiction } from "@/lib/referrals/jurisdiction";

const routeLabel = "/api/referrals/cashout";

const requestSchema = z.object({
  credits_requested: z.number().int().min(1).max(1_000_000),
});

type CashoutRpcResponse = {
  ok?: boolean;
  reason?: string;
  request_id?: string;
  status?: string;
  country_code?: string;
  credits_requested?: number;
  cash_amount?: number;
  currency?: string;
  rate_used?: number;
  total_balance?: number;
  held_credits?: number;
  available_credits?: number;
};

export type ReferralCashoutRouteDeps = {
  requireRole: typeof requireRole;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getUserJurisdiction: typeof getUserJurisdiction;
  now: () => number;
};

const defaultDeps: ReferralCashoutRouteDeps = {
  requireRole,
  hasServiceRoleEnv,
  createServiceRoleClient,
  getUserJurisdiction,
  now: () => Date.now(),
};

function mapStatus(reason: string | undefined): number {
  if (!reason) return 400;
  if (reason === "CASHOUT_DISABLED") return 403;
  if (reason === "INSUFFICIENT_CREDITS") return 409;
  if (reason === "MONTHLY_CAP_EXCEEDED") return 409;
  if (reason === "BELOW_MIN_CASHOUT") return 422;
  return 400;
}

export async function postReferralCashoutResponse(
  request: Request,
  deps: ReferralCashoutRouteDeps = defaultDeps
) {
  const startTime = deps.now();
  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent"],
  });
  if (!auth.ok) return auth.response;

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  const adminClient = deps.createServiceRoleClient() as unknown as SupabaseClient;

  const jurisdiction = await deps.getUserJurisdiction(adminClient, auth.user.id, {
    authMetadataCountry: (auth.user.user_metadata as Record<string, unknown> | null)?.country as
      | string
      | null
      | undefined,
  });

  await adminClient.rpc("referral_sync_wallet_balance", {
    in_user_id: auth.user.id,
  });

  const { data, error } = await adminClient.rpc("request_referral_cashout", {
    in_user_id: auth.user.id,
    in_country_code: jurisdiction.countryCode,
    in_credits_requested: parsed.data.credits_requested,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const payload = (data ?? {}) as CashoutRpcResponse;
  if (!payload.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: payload.reason ?? "REQUEST_FAILED",
      },
      { status: mapStatus(payload.reason) }
    );
  }

  return NextResponse.json({
    ok: true,
    request: {
      id: payload.request_id,
      status: payload.status,
      country_code: payload.country_code,
      credits_requested: payload.credits_requested,
      cash_amount: payload.cash_amount,
      currency: payload.currency,
      rate_used: payload.rate_used,
    },
    wallet: {
      total_balance: payload.total_balance,
      held_credits: payload.held_credits,
      available_credits: payload.available_credits,
    },
  });
}

export async function POST(request: Request) {
  return postReferralCashoutResponse(request);
}
