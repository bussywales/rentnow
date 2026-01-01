import type Stripe from "stripe";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/billing/stripe";
import { getStripePlanByPriceId, type BillingCadence, type BillingRole } from "@/lib/billing/stripe-plans";
import { normalizePlanTier, type PlanTier } from "@/lib/plans";

export type StripePlanMetadata = {
  profileId: string | null;
  role: BillingRole | null;
  tier: PlanTier | null;
  cadence: BillingCadence | null;
};

export function constructStripeEvent(payload: string, signature: string | null) {
  if (!signature) {
    throw new Error("Missing Stripe signature");
  }
  const stripe = getStripeClient();
  const secret = getStripeWebhookSecret();
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

export function extractPlanMetadata(metadata?: Stripe.Metadata | null): StripePlanMetadata {
  const profileId = metadata?.profile_id || metadata?.user_id || null;
  const roleValue = metadata?.role === "agent" || metadata?.role === "landlord" ? metadata.role : null;
  const tierValue = metadata?.plan_tier
    ? normalizePlanTier(metadata.plan_tier)
    : metadata?.tier
    ? normalizePlanTier(metadata.tier)
    : null;
  const cadenceValue = metadata?.cadence === "yearly" || metadata?.cadence === "monthly" ? metadata.cadence : null;

  return {
    profileId,
    role: roleValue,
    tier: tierValue,
    cadence: cadenceValue,
  };
}

export function getSubscriptionPriceId(subscription: Stripe.Subscription) {
  const item = subscription.items?.data?.[0];
  if (!item) return null;
  if (typeof item.price === "string") {
    return item.price;
  }
  return item.price?.id || null;
}

export function resolvePlanFromStripe(
  subscription: Stripe.Subscription,
  fallbackMetadata?: Stripe.Metadata | null
) {
  const priceId = getSubscriptionPriceId(subscription);
  const mapped = priceId ? getStripePlanByPriceId(priceId) : null;
  const metadata = extractPlanMetadata(subscription.metadata || fallbackMetadata || undefined);
  if (mapped?.tier) {
    return {
      profileId: metadata.profileId,
      role: mapped.role ?? metadata.role,
      cadence: mapped.cadence ?? metadata.cadence,
      tier: mapped.tier,
      priceId,
    };
  }
  if (priceId) {
    return {
      profileId: metadata.profileId,
      role: metadata.role,
      cadence: metadata.cadence,
      tier: null,
      priceId,
    };
  }
  if (metadata.tier) {
    return { ...metadata, priceId: null };
  }
  return {
    profileId: metadata.profileId,
    role: metadata.role,
    cadence: metadata.cadence,
    tier: null,
    priceId: null,
  };
}
