import type { UserRole } from "@/lib/types";
import {
  resolveSubscriptionLifecycleState,
  type BillingLifecycleProviderRow,
} from "@/lib/billing/subscription-lifecycle";

export type StripePortalPlanRow = {
  billing_source?: string | null;
  plan_tier?: string | null;
  valid_until?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_status?: string | null;
  stripe_current_period_end?: string | null;
};

export function buildStripeCustomerPortalReturnPath(role: UserRole | null) {
  return role === "tenant" ? "/tenant/billing?stripe=portal-return#plans" : "/dashboard/billing?stripe=portal-return#plans";
}

export function evaluateStripeCustomerPortalAccess(input: {
  plan: StripePortalPlanRow | null;
  providerSubscription?: BillingLifecycleProviderRow | null;
}) {
  const plan = input.plan;
  if ((plan?.billing_source ?? "manual") !== "stripe") {
    return {
      ok: false as const,
      reason: "Only Stripe-backed subscriptions can open the Stripe billing portal.",
    };
  }

  if (!plan?.stripe_customer_id || !plan?.stripe_subscription_id) {
    return {
      ok: false as const,
      reason: "No linked Stripe billing relationship was found for this account.",
    };
  }

  const lifecycle = resolveSubscriptionLifecycleState({
    billingSource: plan.billing_source,
    planTier: plan.plan_tier,
    validUntil: plan.valid_until,
    stripeStatus: plan.stripe_status,
    stripeCurrentPeriodEnd: plan.stripe_current_period_end,
    providerSubscription: input.providerSubscription ?? null,
  });

  if (!lifecycle.portalEligible) {
    return {
      ok: false as const,
      reason: "Subscription management is only available for active Stripe-owned subscriptions or payment issues that still belong to Stripe.",
    };
  }

  return {
    ok: true as const,
    customerId: plan.stripe_customer_id,
    lifecycle,
  };
}
