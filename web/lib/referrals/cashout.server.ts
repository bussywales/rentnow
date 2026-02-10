import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { parseAppSettingInt } from "@/lib/settings/app-settings";
import {
  calculateCashoutPercentFromAmountMajor,
  DEFAULT_REFERRAL_POLICY,
  getReferralWalletSnapshot,
  minorCurrencyToMajor,
  normalizePolicyCountryCode,
  normalizePolicyRow,
  resolvePolicyCashoutRateAmountMinor,
  resolvePolicyCashoutRateMajor,
  type ReferralCashoutRequest,
  type ReferralJurisdictionPolicy,
  type ReferralWalletSnapshot,
} from "@/lib/referrals/cashout";
import { getUserJurisdiction } from "@/lib/referrals/jurisdiction";

async function getPaygListingFeeAmount(client: SupabaseClient): Promise<number> {
  const { data } = await client
    .from("app_settings")
    .select("value")
    .eq("key", APP_SETTING_KEYS.paygListingFeeAmount)
    .maybeSingle<{ value: unknown }>();
  return Math.max(0, parseAppSettingInt(data?.value, 0));
}

export async function getReferralPolicyForCountry(input: {
  countryCode: string;
  serviceClient?: SupabaseClient;
  paygListingFeeAmount?: number | null;
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
      "id, country_code, payouts_enabled, conversion_enabled, credit_to_cash_rate, cashout_rate_mode, cashout_rate_amount_minor, cashout_rate_percent, cashout_eligible_sources, currency, min_cashout_credits, monthly_cashout_cap_amount, requires_manual_approval, updated_at"
    )
    .eq("country_code", countryCode)
    .maybeSingle<ReferralJurisdictionPolicy>();

  const normalized = normalizePolicyRow(
    data || {
      ...DEFAULT_REFERRAL_POLICY,
      country_code: countryCode,
    },
    countryCode
  );

  const paygListingFeeAmount = Math.max(0, Number(input.paygListingFeeAmount || 0));
  const resolvedAmountMinor = resolvePolicyCashoutRateAmountMinor(normalized, {
    paygListingFeeAmount,
  });
  const resolvedRateMajor = resolvePolicyCashoutRateMajor(
    {
      ...normalized,
      cashout_rate_amount_minor: resolvedAmountMinor,
    },
    { paygListingFeeAmount }
  );

  const resolvedPercent =
    normalized.cashout_rate_percent ??
    (paygListingFeeAmount > 0 && resolvedAmountMinor > 0
      ? calculateCashoutPercentFromAmountMajor({
          paygListingFeeAmount,
          amountMajor: minorCurrencyToMajor(resolvedAmountMinor),
        })
      : null);

  return {
    ...normalized,
    cashout_rate_amount_minor: resolvedAmountMinor,
    credit_to_cash_rate: resolvedRateMajor,
    cashout_rate_percent: resolvedPercent,
  };
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

  const [paygListingFeeAmount, walletRes, requestsRes] = await Promise.all([
    getPaygListingFeeAmount(serviceClient ?? input.userClient),
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

  const policy = await getReferralPolicyForCountry({
    countryCode: jurisdiction.countryCode,
    serviceClient: serviceClient ?? undefined,
    paygListingFeeAmount,
  });

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
