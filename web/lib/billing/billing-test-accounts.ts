import { isPlanExpired } from "@/lib/plans";

type BillingTestSnapshotLike = {
  effectivePlanTier?: string | null;
  billingSource?: string | null;
  validUntil?: string | null;
  stripeCustomerIdPresent?: boolean;
  stripeSubscriptionIdPresent?: boolean;
  stripePriceIdPresent?: boolean;
  stripeStatus?: string | null;
};

type BillingSubscriptionLike = {
  provider?: string | null;
  provider_subscription_id?: string | null;
  status?: string | null;
  current_period_end?: string | null;
};

export type BillingResetBlocker = {
  provider: string | null;
  providerSubscriptionId: string | null;
  status: string | null;
  currentPeriodEnd: string | null;
};

export type BillingTestabilityState = {
  isDesignatedTestAccount: boolean;
  canReset: boolean;
  reusableNow: boolean;
  providerStatePresent: boolean;
  blocker: BillingResetBlocker | null;
  status: "not_test_account" | "blocked_active_subscription" | "ready_now" | "reset_available";
  message: string;
};

const INTERNAL_BILLING_TEST_DOMAINS = ["propatyhub.test", "rentnow.test"] as const;
const BLOCKING_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

function normalizeEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function parseAllowlistedEmails(raw = process.env.BILLING_TEST_ACCOUNT_EMAILS ?? "") {
  return new Set(
    raw
      .split(",")
      .map((value) => normalizeEmail(value))
      .filter(Boolean)
  );
}

export function isDesignatedBillingTestAccountEmail(
  email: string | null | undefined,
  options?: { allowlistedEmails?: Set<string> }
) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const allowlistedEmails = options?.allowlistedEmails ?? parseAllowlistedEmails();
  if (allowlistedEmails.has(normalized)) return true;

  const atIndex = normalized.lastIndexOf("@");
  if (atIndex < 0) return false;
  const domain = normalized.slice(atIndex + 1);
  return INTERNAL_BILLING_TEST_DOMAINS.includes(domain as (typeof INTERNAL_BILLING_TEST_DOMAINS)[number]);
}

export function findBillingResetBlocker(rows: BillingSubscriptionLike[]): BillingResetBlocker | null {
  const blocking = rows.find((row) => BLOCKING_SUBSCRIPTION_STATUSES.has(String(row.status || "")));
  if (!blocking) return null;

  return {
    provider: blocking.provider ?? null,
    providerSubscriptionId: blocking.provider_subscription_id ?? null,
    status: blocking.status ?? null,
    currentPeriodEnd: blocking.current_period_end ?? null,
  };
}

export function isBillingSmokeReady(
  snapshot: BillingTestSnapshotLike,
  blocker: BillingResetBlocker | null
) {
  if (blocker) return false;

  const manualSource = (snapshot.billingSource ?? "") === "manual";
  const manualExpired = manualSource ? isPlanExpired(snapshot.validUntil ?? null) : false;
  const providerBitsPresent = Boolean(
    snapshot.stripeCustomerIdPresent ||
      snapshot.stripeSubscriptionIdPresent ||
      snapshot.stripePriceIdPresent ||
      snapshot.stripeStatus
  );

  return (
    (snapshot.effectivePlanTier ?? "free") === "free" &&
    !providerBitsPresent &&
    (!manualSource || manualExpired)
  );
}

export function evaluateBillingTestability(input: {
  email: string | null | undefined;
  snapshot: BillingTestSnapshotLike;
  subscriptionRows: BillingSubscriptionLike[];
}) : BillingTestabilityState {
  const isDesignatedTestAccount = isDesignatedBillingTestAccountEmail(input.email);
  const blocker = findBillingResetBlocker(input.subscriptionRows);
  const providerStatePresent = Boolean(
    input.snapshot.stripeCustomerIdPresent ||
      input.snapshot.stripeSubscriptionIdPresent ||
      input.snapshot.stripePriceIdPresent ||
      input.snapshot.stripeStatus ||
      input.subscriptionRows.length
  );
  const reusableNow = isBillingSmokeReady(input.snapshot, blocker);

  if (!isDesignatedTestAccount) {
    return {
      isDesignatedTestAccount,
      canReset: false,
      reusableNow: false,
      providerStatePresent,
      blocker,
      status: "not_test_account",
      message:
        "Reset is unavailable. This account is not a designated internal billing test account. Allowed accounts must use BILLING_TEST_ACCOUNT_EMAILS or an internal .test domain.",
    };
  }

  if (blocker) {
    return {
      isDesignatedTestAccount,
      canReset: false,
      reusableNow: false,
      providerStatePresent,
      blocker,
      status: "blocked_active_subscription",
      message:
        "Reset is blocked because an active provider subscription still exists. Cancel the live/test subscription first. Historical Stripe, subscriptions, and webhook rows are preserved.",
    };
  }

  if (reusableNow) {
    return {
      isDesignatedTestAccount,
      canReset: true,
      reusableNow: true,
      providerStatePresent,
      blocker: null,
      status: "ready_now",
      message:
        "This designated test account is already reusable for a new smoke. Reset remains available if you want to clear stale local billing state again.",
    };
  }

  return {
    isDesignatedTestAccount,
    canReset: true,
    reusableNow: false,
    providerStatePresent,
    blocker: null,
    status: "reset_available",
    message:
      "This designated test account can be reset to a free expired-manual baseline for the next smoke. Reset clears current profile_plans state only and preserves historical subscriptions and webhook records.",
  };
}
