import { isPlanExpired, normalizePlanTier, resolveEffectivePlanTier } from "@/lib/plans";

export type BillingLifecycleProviderRow = {
  provider?: string | null;
  provider_subscription_id?: string | null;
  status?: string | null;
  current_period_end?: string | null;
  canceled_at?: string | null;
};

export type SubscriptionLifecycleKey =
  | "free_baseline"
  | "manual_override"
  | "active_paid"
  | "cancelled_period_end"
  | "payment_issue"
  | "expired";

export type SubscriptionLifecycleTone = "neutral" | "positive" | "warning" | "danger";

export type SubscriptionLifecycleState = {
  key: SubscriptionLifecycleKey;
  label: string;
  tone: SubscriptionLifecycleTone;
  description: string;
  renewalAt: string | null;
  accessUntil: string | null;
  cancellationRequestedAt: string | null;
  providerStatus: string | null;
  providerSubscriptionId: string | null;
  portalEligible: boolean;
};

type Input = {
  billingSource?: string | null;
  planTier?: string | null;
  effectivePlanTier?: string | null;
  validUntil?: string | null;
  stripeStatus?: string | null;
  stripeCurrentPeriodEnd?: string | null;
  providerSubscription?: BillingLifecycleProviderRow | null;
  now?: number;
};

function isFutureIso(value: string | null | undefined, now: number) {
  return !!value && Number.isFinite(Date.parse(value)) && Date.parse(value) > now;
}

function resolveStatus(input: Input) {
  return input.providerSubscription?.status ?? input.stripeStatus ?? null;
}

function resolveAccessUntil(input: Input) {
  return input.validUntil ?? input.providerSubscription?.current_period_end ?? input.stripeCurrentPeriodEnd ?? null;
}

export function resolveSubscriptionLifecycleState(input: Input): SubscriptionLifecycleState {
  const now = input.now ?? Date.now();
  const billingSource = input.billingSource ?? "manual";
  const effectivePlanTier = normalizePlanTier(
    input.effectivePlanTier ?? resolveEffectivePlanTier(input.planTier ?? "free", input.validUntil ?? null, now)
  );
  const providerStatus = resolveStatus(input);
  const accessUntil = resolveAccessUntil(input);
  const cancellationRequestedAt = input.providerSubscription?.canceled_at ?? null;
  const providerSubscriptionId = input.providerSubscription?.provider_subscription_id ?? null;
  const paidAccessActive = effectivePlanTier !== "free" && !isPlanExpired(accessUntil, now);
  const cancelledAtPeriodEnd =
    billingSource === "stripe" &&
    !!cancellationRequestedAt &&
    isFutureIso(accessUntil, now) &&
    (providerStatus === "active" || providerStatus === "trialing" || providerStatus === "past_due" || providerStatus === "unpaid");

  if (billingSource === "manual") {
    if (paidAccessActive) {
      return {
        key: "manual_override",
        label: "Manual override",
        tone: "warning",
        description: "Manual billing controls this account until the override expires or support returns ownership to a provider.",
        renewalAt: null,
        accessUntil,
        cancellationRequestedAt: null,
        providerStatus,
        providerSubscriptionId,
        portalEligible: false,
      };
    }

    if (isPlanExpired(accessUntil, now)) {
      return {
        key: "expired",
        label: "Expired",
        tone: "danger",
        description: "The previous manual entitlement has ended. The account has fallen back to the free baseline until a provider-owned subscription is restored.",
        renewalAt: null,
        accessUntil,
        cancellationRequestedAt: null,
        providerStatus,
        providerSubscriptionId,
        portalEligible: false,
      };
    }

    return {
      key: "free_baseline",
      label: "Free baseline",
      tone: "neutral",
      description: "No paid provider-owned subscription is currently active on this account.",
      renewalAt: null,
      accessUntil: null,
      cancellationRequestedAt: null,
      providerStatus,
      providerSubscriptionId,
      portalEligible: false,
    };
  }

  if (cancelledAtPeriodEnd) {
    return {
      key: "cancelled_period_end",
      label: "Cancelled at period end",
      tone: "warning",
      description: "The subscription is still active for the current paid period, but cancellation has already been requested.",
      renewalAt: null,
      accessUntil,
      cancellationRequestedAt,
      providerStatus,
      providerSubscriptionId,
      portalEligible: true,
    };
  }

  if (billingSource === "stripe" && ["past_due", "unpaid", "incomplete"].includes(providerStatus ?? "")) {
    return {
      key: "payment_issue",
      label: "Payment issue",
      tone: "warning",
      description: "Stripe still owns billing, but payment collection needs attention before renewal is safe.",
      renewalAt: accessUntil,
      accessUntil,
      cancellationRequestedAt,
      providerStatus,
      providerSubscriptionId,
      portalEligible: true,
    };
  }

  if (paidAccessActive) {
    return {
      key: "active_paid",
      label: "Active paid subscription",
      tone: "positive",
      description: "Provider-owned billing is active and the account is entitled through the current billing period.",
      renewalAt: accessUntil,
      accessUntil,
      cancellationRequestedAt,
      providerStatus,
      providerSubscriptionId,
      portalEligible: billingSource === "stripe",
    };
  }

  if (isPlanExpired(accessUntil, now) || ["canceled", "incomplete_expired", "ended"].includes(providerStatus ?? "")) {
    return {
      key: "expired",
      label: "Expired",
      tone: "danger",
      description: "The last paid entitlement has ended. Billing history is preserved, but the account no longer has paid access.",
      renewalAt: null,
      accessUntil,
      cancellationRequestedAt,
      providerStatus,
      providerSubscriptionId,
      portalEligible: false,
    };
  }

  return {
    key: "free_baseline",
    label: "Free baseline",
    tone: "neutral",
    description: "No paid provider-owned subscription is currently active on this account.",
    renewalAt: null,
    accessUntil: null,
    cancellationRequestedAt,
    providerStatus,
    providerSubscriptionId,
    portalEligible: false,
  };
}
