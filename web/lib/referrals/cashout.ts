import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCountryCode } from "@/lib/countries";

export type ReferralCashoutStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "paid"
  | "void";

export const REFERRAL_CASHOUT_RATE_MODES = ["fixed", "percent_of_payg"] as const;
export type ReferralCashoutRateMode = (typeof REFERRAL_CASHOUT_RATE_MODES)[number];

export const REFERRAL_CASHOUT_ELIGIBLE_SOURCES = [
  "payg_listing_fee_paid",
  "featured_purchase_paid",
  "subscription_paid",
] as const;
export type ReferralCashoutEligibleSource = (typeof REFERRAL_CASHOUT_ELIGIBLE_SOURCES)[number];

export type ReferralJurisdictionPolicy = {
  id: string;
  country_code: string;
  payouts_enabled: boolean;
  conversion_enabled: boolean;
  credit_to_cash_rate: number;
  cashout_rate_mode: ReferralCashoutRateMode;
  cashout_rate_amount_minor: number | null;
  cashout_rate_percent: number | null;
  cashout_eligible_sources: ReferralCashoutEligibleSource[];
  currency: string;
  min_cashout_credits: number;
  monthly_cashout_cap_amount: number;
  requires_manual_approval: boolean;
  updated_at: string;
};

export type ReferralWalletSnapshot = {
  total_balance: number;
  held_credits: number;
  available_credits: number;
};

export type ReferralCashoutRequest = {
  id: string;
  user_id: string;
  country_code: string;
  credits_requested: number;
  cash_amount: number;
  currency: string;
  rate_used: number;
  status: ReferralCashoutStatus;
  admin_note: string | null;
  payout_reference: string | null;
  requested_at: string;
  decided_at: string | null;
  paid_at: string | null;
};

export type CashoutGuardInput = {
  policy: Pick<
    ReferralJurisdictionPolicy,
    | "payouts_enabled"
    | "conversion_enabled"
    | "credit_to_cash_rate"
    | "cashout_rate_mode"
    | "cashout_rate_amount_minor"
    | "cashout_rate_percent"
    | "min_cashout_credits"
    | "monthly_cashout_cap_amount"
  >;
  creditsRequested: number;
  availableCredits: number;
  monthToDateCashAmount: number;
  paygListingFeeAmount?: number | null;
};

export type CashoutGuardResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "CASHOUT_DISABLED"
        | "INVALID_RATE"
        | "INVALID_CREDITS_REQUESTED"
        | "BELOW_MIN_CASHOUT"
        | "INSUFFICIENT_CREDITS"
        | "MONTHLY_CAP_EXCEEDED";
    };

export const DEFAULT_REFERRAL_POLICY: Omit<ReferralJurisdictionPolicy, "id" | "updated_at"> = {
  country_code: "NG",
  payouts_enabled: false,
  conversion_enabled: false,
  credit_to_cash_rate: 0,
  cashout_rate_mode: "fixed",
  cashout_rate_amount_minor: 0,
  cashout_rate_percent: null,
  cashout_eligible_sources: ["payg_listing_fee_paid", "featured_purchase_paid"],
  currency: "NGN",
  min_cashout_credits: 0,
  monthly_cashout_cap_amount: 0,
  requires_manual_approval: true,
};

export function normalizePolicyCountryCode(value: string | null | undefined): string {
  return normalizeCountryCode(value) || DEFAULT_REFERRAL_POLICY.country_code;
}

export function calculateAvailableCredits(totalBalance: number, heldCredits: number): number {
  return Math.max(0, Math.trunc(totalBalance) - Math.max(0, Math.trunc(heldCredits)));
}

export function applyPendingHold(
  currentHeldCredits: number,
  creditsRequested: number,
  options?: { alreadyHeld?: boolean }
): number {
  const held = Math.max(0, Math.trunc(currentHeldCredits));
  if (options?.alreadyHeld) return held;
  return held + Math.max(0, Math.trunc(creditsRequested));
}

function normalizeCashoutRateMode(value: unknown): ReferralCashoutRateMode {
  if (value === "percent_of_payg") return "percent_of_payg";
  return "fixed";
}

export function majorCurrencyToMinor(value: number): number {
  const safe = Number(value);
  if (!Number.isFinite(safe) || safe <= 0) return 0;
  return Math.max(0, Math.round(safe * 100));
}

export function minorCurrencyToMajor(value: number | null | undefined): number {
  const safe = Number(value);
  if (!Number.isFinite(safe) || safe <= 0) return 0;
  return safe / 100;
}

export function calculateCashoutAmountMajorFromPercent(input: {
  paygListingFeeAmount: number;
  percent: number;
}): number {
  const paygListingFeeAmount = Math.max(0, Number(input.paygListingFeeAmount || 0));
  const percent = Math.max(0, Number(input.percent || 0));
  if (!paygListingFeeAmount || !percent) return 0;

  const amountMinor = Math.round(paygListingFeeAmount * percent);
  return minorCurrencyToMajor(amountMinor);
}

export function calculateCashoutPercentFromAmountMajor(input: {
  paygListingFeeAmount: number;
  amountMajor: number;
}): number {
  const paygListingFeeAmount = Math.max(0, Number(input.paygListingFeeAmount || 0));
  const amountMajor = Math.max(0, Number(input.amountMajor || 0));
  if (!paygListingFeeAmount || !amountMajor) return 0;
  return Number(((amountMajor / paygListingFeeAmount) * 100).toFixed(4));
}

function normalizeCashoutEligibleSources(
  value: unknown
): ReferralCashoutEligibleSource[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_REFERRAL_POLICY.cashout_eligible_sources];
  }

  const raw = value;
  const normalized = raw
    .map((entry) => String(entry || "").trim())
    .filter((entry): entry is ReferralCashoutEligibleSource =>
      (
        REFERRAL_CASHOUT_ELIGIBLE_SOURCES as readonly string[]
      ).includes(entry)
    );

  return Array.from(new Set(normalized));
}

export function resolvePolicyCashoutRateAmountMinor(
  policy: Pick<
    ReferralJurisdictionPolicy,
    | "credit_to_cash_rate"
    | "cashout_rate_mode"
    | "cashout_rate_amount_minor"
    | "cashout_rate_percent"
  >,
  options?: { paygListingFeeAmount?: number | null }
): number {
  const directMinor = Math.max(0, Math.trunc(Number(policy.cashout_rate_amount_minor || 0)));
  if (directMinor > 0) return directMinor;

  if (policy.cashout_rate_mode === "percent_of_payg") {
    const paygListingFeeAmount = Math.max(0, Number(options?.paygListingFeeAmount || 0));
    const percent = Math.max(0, Number(policy.cashout_rate_percent || 0));
    if (paygListingFeeAmount > 0 && percent > 0) {
      return majorCurrencyToMinor(
        calculateCashoutAmountMajorFromPercent({
          paygListingFeeAmount,
          percent,
        })
      );
    }
  }

  return majorCurrencyToMinor(Math.max(0, Number(policy.credit_to_cash_rate || 0)));
}

export function resolvePolicyCashoutRateMajor(
  policy: Pick<
    ReferralJurisdictionPolicy,
    | "credit_to_cash_rate"
    | "cashout_rate_mode"
    | "cashout_rate_amount_minor"
    | "cashout_rate_percent"
  >,
  options?: { paygListingFeeAmount?: number | null }
): number {
  const resolvedMinor = resolvePolicyCashoutRateAmountMinor(policy, options);
  if (resolvedMinor > 0) return minorCurrencyToMajor(resolvedMinor);
  return Math.max(0, Number(policy.credit_to_cash_rate || 0));
}

export function validateCashoutGuard(input: CashoutGuardInput): CashoutGuardResult {
  const creditsRequested = Math.max(0, Math.trunc(input.creditsRequested));
  const availableCredits = Math.max(0, Math.trunc(input.availableCredits));
  const minCashoutCredits = Math.max(0, Math.trunc(input.policy.min_cashout_credits));
  const monthlyCap = Math.max(0, Number(input.policy.monthly_cashout_cap_amount || 0));
  const monthToDateCashAmount = Math.max(0, Number(input.monthToDateCashAmount || 0));
  const rateAmountMinor = resolvePolicyCashoutRateAmountMinor(input.policy, {
    paygListingFeeAmount: input.paygListingFeeAmount,
  });

  if (!input.policy.payouts_enabled || !input.policy.conversion_enabled) {
    return { ok: false, reason: "CASHOUT_DISABLED" };
  }

  if (!Number.isFinite(rateAmountMinor) || rateAmountMinor <= 0) {
    return { ok: false, reason: "INVALID_RATE" };
  }

  if (!creditsRequested) {
    return { ok: false, reason: "INVALID_CREDITS_REQUESTED" };
  }

  if (creditsRequested < minCashoutCredits) {
    return { ok: false, reason: "BELOW_MIN_CASHOUT" };
  }

  if (creditsRequested > availableCredits) {
    return { ok: false, reason: "INSUFFICIENT_CREDITS" };
  }

  const projectedCashout = (creditsRequested * rateAmountMinor) / 100;
  if (monthlyCap > 0 && monthToDateCashAmount + projectedCashout > monthlyCap) {
    return { ok: false, reason: "MONTHLY_CAP_EXCEEDED" };
  }

  return { ok: true };
}

export function normalizePolicyRow(
  row: Partial<ReferralJurisdictionPolicy> | null | undefined,
  countryCode: string
): ReferralJurisdictionPolicy {
  const normalizedCountryCode = normalizePolicyCountryCode(row?.country_code || countryCode);
  const cashout_rate_mode = normalizeCashoutRateMode(row?.cashout_rate_mode);
  const cashout_rate_amount_minor = Math.max(
    0,
    Math.trunc(Number(row?.cashout_rate_amount_minor || 0))
  );
  const cashout_rate_percent =
    row?.cashout_rate_percent === null || row?.cashout_rate_percent === undefined
      ? null
      : Math.max(0, Number(row.cashout_rate_percent));

  return {
    id: String(row?.id || `default-${normalizedCountryCode}`),
    country_code: normalizedCountryCode,
    payouts_enabled: Boolean(row?.payouts_enabled),
    conversion_enabled: Boolean(row?.conversion_enabled),
    credit_to_cash_rate: Math.max(
      0,
      Number(
        row?.credit_to_cash_rate ??
          minorCurrencyToMajor(cashout_rate_amount_minor)
      )
    ),
    cashout_rate_mode,
    cashout_rate_amount_minor,
    cashout_rate_percent,
    cashout_eligible_sources: normalizeCashoutEligibleSources(
      (row as { cashout_eligible_sources?: unknown } | undefined)?.cashout_eligible_sources
    ),
    currency: String(row?.currency || DEFAULT_REFERRAL_POLICY.currency),
    min_cashout_credits: Math.max(0, Math.trunc(Number(row?.min_cashout_credits || 0))),
    monthly_cashout_cap_amount: Math.max(0, Number(row?.monthly_cashout_cap_amount || 0)),
    requires_manual_approval:
      row?.requires_manual_approval === undefined
        ? true
        : Boolean(row.requires_manual_approval),
    updated_at: String(row?.updated_at || new Date(0).toISOString()),
  };
}

export async function getReferralWalletSnapshot(
  client: SupabaseClient,
  userId: string
): Promise<ReferralWalletSnapshot> {
  const [{ data: wallet }, { data: heldRows }] = await Promise.all([
    client
      .from("referral_credit_wallet")
      .select("credits_balance")
      .eq("user_id", userId)
      .maybeSingle<{ credits_balance: number | null }>(),
    client
      .from("referral_cashout_requests")
      .select("credits_requested")
      .eq("user_id", userId)
      .in("status", ["pending", "approved"]),
  ]);

  const total_balance = Math.max(0, Math.trunc(Number(wallet?.credits_balance || 0)));
  const held_credits = ((heldRows as Array<{ credits_requested: number | null }> | null) ?? []).reduce(
    (sum, row) => sum + Math.max(0, Math.trunc(Number(row.credits_requested || 0))),
    0
  );

  return {
    total_balance,
    held_credits,
    available_credits: calculateAvailableCredits(total_balance, held_credits),
  };
}
