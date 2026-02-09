import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCountryCode } from "@/lib/countries";

export type ReferralCashoutStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "paid"
  | "void";

export type ReferralJurisdictionPolicy = {
  id: string;
  country_code: string;
  payouts_enabled: boolean;
  conversion_enabled: boolean;
  credit_to_cash_rate: number;
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
    | "min_cashout_credits"
    | "monthly_cashout_cap_amount"
  >;
  creditsRequested: number;
  availableCredits: number;
  monthToDateCashAmount: number;
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

export function validateCashoutGuard(input: CashoutGuardInput): CashoutGuardResult {
  const creditsRequested = Math.max(0, Math.trunc(input.creditsRequested));
  const availableCredits = Math.max(0, Math.trunc(input.availableCredits));
  const minCashoutCredits = Math.max(0, Math.trunc(input.policy.min_cashout_credits));
  const monthlyCap = Math.max(0, Number(input.policy.monthly_cashout_cap_amount || 0));
  const monthToDateCashAmount = Math.max(0, Number(input.monthToDateCashAmount || 0));
  const rate = Number(input.policy.credit_to_cash_rate || 0);

  if (!input.policy.payouts_enabled || !input.policy.conversion_enabled) {
    return { ok: false, reason: "CASHOUT_DISABLED" };
  }

  if (!Number.isFinite(rate) || rate <= 0) {
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

  const projectedCashout = creditsRequested * rate;
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

  return {
    id: String(row?.id || `default-${normalizedCountryCode}`),
    country_code: normalizedCountryCode,
    payouts_enabled: Boolean(row?.payouts_enabled),
    conversion_enabled: Boolean(row?.conversion_enabled),
    credit_to_cash_rate: Math.max(0, Number(row?.credit_to_cash_rate || 0)),
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
