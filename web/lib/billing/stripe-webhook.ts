import type Stripe from "stripe";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/billing/stripe";
import { getStripePlanByPriceId, type BillingCadence, type BillingRole } from "@/lib/billing/stripe-plans";
import {
  loadSubscriptionPriceBookRowsByProviderPriceRef,
} from "@/lib/billing/subscription-price-book.repository";
import {
  selectCurrentCanonicalRow,
  type SubscriptionPriceBookRow,
} from "@/lib/billing/subscription-price-book";
import { normalizePlanTier, type PlanTier } from "@/lib/plans";

export type StripePlanMetadata = {
  profileId: string | null;
  role: BillingRole | null;
  tier: PlanTier | null;
  cadence: BillingCadence | null;
};

export type ResolvedStripePlan = {
  profileId: string | null;
  role: BillingRole | null;
  cadence: BillingCadence | null;
  tier: PlanTier | null;
  priceId: string | null;
};

type StripePlanMarketMetadata = {
  marketCountry: string | null;
  marketCurrency: string | null;
};

export function requireCheckoutMetadata(metadata?: Stripe.Metadata | null) {
  const profileId = metadata?.user_id || metadata?.profile_id || null;
  const tierRaw = metadata?.plan_tier || metadata?.tier || null;
  const tier = tierRaw ? normalizePlanTier(tierRaw) : null;
  return {
    ok: !!profileId && !!tier,
    profileId,
    tier,
  };
}

export function constructStripeEvent(
  payload: string,
  signature: string | null,
  options?: { secretKey?: string | null; webhookSecret?: string | null }
) {
  if (!signature) {
    throw new Error("Missing Stripe signature");
  }
  const stripe = getStripeClient(options?.secretKey);
  const secret = getStripeWebhookSecret(options?.webhookSecret);
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

export function extractPlanMetadata(metadata?: Stripe.Metadata | null): StripePlanMetadata {
  const profileId = metadata?.profile_id || metadata?.user_id || null;
  const roleValue =
    metadata?.role === "agent" || metadata?.role === "landlord" || metadata?.role === "tenant"
      ? metadata.role
      : null;
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

function extractMarketMetadata(metadata?: Stripe.Metadata | null): StripePlanMarketMetadata {
  const marketCountryRaw = metadata?.subscription_market_country || null;
  const marketCurrencyRaw = metadata?.subscription_market_currency || null;
  const marketCountry =
    typeof marketCountryRaw === "string" && /^[A-Z]{2}$/i.test(marketCountryRaw)
      ? marketCountryRaw.toUpperCase()
      : null;
  const marketCurrency =
    typeof marketCurrencyRaw === "string" && /^[A-Z]{3}$/i.test(marketCurrencyRaw)
      ? marketCurrencyRaw.toUpperCase()
      : null;
  return { marketCountry, marketCurrency };
}

export function getSubscriptionPriceId(subscription: Stripe.Subscription) {
  const item = subscription.items?.data?.[0];
  if (!item) return null;
  if (typeof item.price === "string") {
    return item.price;
  }
  return item.price?.id || null;
}

async function loadStripePlanByPriceId(priceId: string, metadata?: Stripe.Metadata | null) {
  const envMatch = getStripePlanByPriceId(priceId);
  if (envMatch) return envMatch;

  const canonicalRows = await loadSubscriptionPriceBookRowsByProviderPriceRef("stripe", priceId);
  const canonicalRow = selectCurrentCanonicalStripePlanRow(canonicalRows, metadata);
  if (!canonicalRow) return null;

  return {
    role: canonicalRow.role,
    tier: canonicalRow.tier,
    cadence: canonicalRow.cadence,
    priceId,
    currency: canonicalRow.currency,
  };
}

export function selectCurrentCanonicalStripePlanRow(
  rows: SubscriptionPriceBookRow[],
  metadata?: Stripe.Metadata | null
) {
  const { marketCountry, marketCurrency } = extractMarketMetadata(metadata);
  if (marketCountry) {
    const countryRows = rows.filter((row) => row.market_country === marketCountry);
    if (countryRows.length) return selectCurrentCanonicalRow(countryRows);
  }
  if (marketCurrency) {
    const currencyRows = rows.filter((row) => row.currency === marketCurrency);
    if (currencyRows.length) return selectCurrentCanonicalRow(currencyRows);
  }
  return selectCurrentCanonicalRow(rows);
}

export function resolvePlanFromStripe(
  subscription: Stripe.Subscription,
  fallbackMetadata?: Stripe.Metadata | null
): ResolvedStripePlan {
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

export async function resolvePlanFromStripeAsync(
  subscription: Stripe.Subscription,
  fallbackMetadata?: Stripe.Metadata | null,
  options?: {
    loadPlanByPriceId?: (
      priceId: string,
      metadata?: Stripe.Metadata | null
    ) => Promise<Awaited<ReturnType<typeof loadStripePlanByPriceId>>>;
  }
): Promise<ResolvedStripePlan> {
  const priceId = getSubscriptionPriceId(subscription);
  const metadata = subscription.metadata || fallbackMetadata || undefined;
  const loadPlanByPriceId = options?.loadPlanByPriceId ?? loadStripePlanByPriceId;
  const mapped = priceId ? await loadPlanByPriceId(priceId, metadata) : null;
  const planMetadata = extractPlanMetadata(metadata);

  if (mapped?.tier) {
    return {
      profileId: planMetadata.profileId,
      role: mapped.role ?? planMetadata.role,
      cadence: mapped.cadence ?? planMetadata.cadence,
      tier: mapped.tier,
      priceId,
    };
  }
  if (priceId) {
    return {
      profileId: planMetadata.profileId,
      role: planMetadata.role,
      cadence: planMetadata.cadence,
      tier: null,
      priceId,
    };
  }
  if (planMetadata.tier) {
    return { ...planMetadata, priceId: null };
  }
  return {
    profileId: planMetadata.profileId,
    role: planMetadata.role,
    cadence: planMetadata.cadence,
    tier: null,
    priceId: null,
  };
}
