import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import {
  DEFAULT_REFERRAL_POLICY,
  REFERRAL_CASHOUT_ELIGIBLE_SOURCES,
  majorCurrencyToMinor,
  minorCurrencyToMajor,
  normalizePolicyCountryCode,
} from "@/lib/referrals/cashout";

export type ReferralPolicyUpsertInput = {
  country_code: string;
  payouts_enabled?: boolean;
  conversion_enabled?: boolean;
  credit_to_cash_rate?: number;
  cashout_rate_mode?: "fixed" | "percent_of_payg";
  cashout_rate_amount_minor?: number | null;
  cashout_rate_percent?: number | null;
  cashout_eligible_sources?: readonly string[];
  currency?: string;
  min_cashout_credits?: number;
  monthly_cashout_cap_amount?: number;
  requires_manual_approval?: boolean;
};

export const REFERRAL_POLICY_SELECT =
  "id, country_code, payouts_enabled, conversion_enabled, credit_to_cash_rate, cashout_rate_mode, cashout_rate_amount_minor, cashout_rate_percent, cashout_eligible_sources, currency, min_cashout_credits, monthly_cashout_cap_amount, requires_manual_approval, updated_at";

export function normalizePolicyEligibleSources(value: readonly string[] | undefined) {
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

export function buildReferralPolicyUpsertRow(
  payload: ReferralPolicyUpsertInput,
  updatedAt: string
) {
  const cashoutRateMode = payload.cashout_rate_mode ?? "fixed";
  const cashoutRateAmountMinor =
    payload.cashout_rate_amount_minor ??
    (payload.credit_to_cash_rate !== undefined
      ? majorCurrencyToMinor(payload.credit_to_cash_rate)
      : 0);
  const cashoutRatePercent =
    payload.cashout_rate_percent === undefined ? null : payload.cashout_rate_percent;
  const cashoutEligibleSources = normalizePolicyEligibleSources(payload.cashout_eligible_sources);

  return {
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
    updated_at: updatedAt,
  };
}

export async function upsertReferralJurisdictionPolicy(
  adminClient: UntypedAdminClient,
  payload: ReferralPolicyUpsertInput,
  now: string
) {
  const row = buildReferralPolicyUpsertRow(payload, now);
  return adminClient
    .from("referral_jurisdiction_policies")
    .upsert(row, { onConflict: "country_code" })
    .select(REFERRAL_POLICY_SELECT)
    .maybeSingle();
}
