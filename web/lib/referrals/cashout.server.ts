import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  DEFAULT_REFERRAL_POLICY,
  getReferralWalletSnapshot,
  normalizePolicyCountryCode,
  normalizePolicyRow,
  type ReferralCashoutRequest,
  type ReferralJurisdictionPolicy,
  type ReferralWalletSnapshot,
} from "@/lib/referrals/cashout";
import { getUserJurisdiction } from "@/lib/referrals/jurisdiction";

export async function getReferralPolicyForCountry(input: {
  countryCode: string;
  serviceClient?: SupabaseClient;
}): Promise<ReferralJurisdictionPolicy> {
  const countryCode = normalizePolicyCountryCode(input.countryCode);
  const serviceClient = input.serviceClient;

  if (!serviceClient) {
    return normalizePolicyRow(
      {
        ...DEFAULT_REFERRAL_POLICY,
        country_code: countryCode,
      },
      countryCode
    );
  }

  const { data } = await serviceClient
    .from("referral_jurisdiction_policies")
    .select(
      "id, country_code, payouts_enabled, conversion_enabled, credit_to_cash_rate, currency, min_cashout_credits, monthly_cashout_cap_amount, requires_manual_approval, updated_at"
    )
    .eq("country_code", countryCode)
    .maybeSingle<ReferralJurisdictionPolicy>();

  return normalizePolicyRow(
    data || {
      ...DEFAULT_REFERRAL_POLICY,
      country_code: countryCode,
    },
    countryCode
  );
}

export async function syncReferralWalletBalance(input: {
  userId: string;
  serviceClient?: SupabaseClient;
}) {
  if (!input.serviceClient) return;
  try {
    await input.serviceClient.rpc("referral_sync_wallet_balance", {
      in_user_id: input.userId,
    });
  } catch {
    // Best effort sync.
  }
}

export async function getUserReferralCashoutContext(input: {
  userClient: SupabaseClient;
  userId: string;
  authMetadataCountry?: string | null;
}): Promise<{
  jurisdiction: Awaited<ReturnType<typeof getUserJurisdiction>>;
  policy: ReferralJurisdictionPolicy;
  wallet: ReferralWalletSnapshot;
  requests: ReferralCashoutRequest[];
}> {
  const serviceClient = hasServiceRoleEnv()
    ? (createServiceRoleClient() as unknown as SupabaseClient)
    : null;

  const jurisdiction = await getUserJurisdiction(serviceClient ?? input.userClient, input.userId, {
    authMetadataCountry: input.authMetadataCountry,
  });

  await syncReferralWalletBalance({ userId: input.userId, serviceClient: serviceClient ?? undefined });

  const [policy, walletRes, requestsRes] = await Promise.all([
    getReferralPolicyForCountry({
      countryCode: jurisdiction.countryCode,
      serviceClient: serviceClient ?? undefined,
    }),
    getReferralWalletSnapshot(input.userClient, input.userId),
    input.userClient
      .from("referral_cashout_requests")
      .select(
        "id, user_id, country_code, credits_requested, cash_amount, currency, rate_used, status, admin_note, payout_reference, requested_at, decided_at, paid_at"
      )
      .eq("user_id", input.userId)
      .order("requested_at", { ascending: false })
      .limit(10),
  ]);

  const requests = ((requestsRes.data as ReferralCashoutRequest[] | null) ?? []).map((row) => ({
    ...row,
    status: row.status,
  }));

  return {
    jurisdiction,
    policy,
    wallet: walletRes,
    requests,
  };
}
