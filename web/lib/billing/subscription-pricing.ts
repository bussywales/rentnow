import type { PlanTier } from "@/lib/plans";
import type { ProviderMode } from "@/lib/billing/provider-settings";
import type { BillingCadence, BillingRole } from "@/lib/billing/stripe-plans";
import { resolveStripePriceSelection } from "@/lib/billing/stripe-plans";
import { resolveProviderPricing } from "@/lib/billing/provider-payments";
import { getStripeClient } from "@/lib/billing/stripe";
import { formatCurrencyMinor } from "@/lib/money/multi-currency";
import { formatMarketLabel, type ResolvedMarket } from "@/lib/market/market";
import type {
  SubscriptionCheckoutProvider,
  SubscriptionPlanPricingSet,
  SubscriptionPlanPricingView,
} from "@/lib/billing/subscription-pricing.types";

type StripeCandidate = {
  provider: "stripe";
  providerMode: ProviderMode;
  currency: string;
  amountMinor: number;
  marketAligned: boolean;
  fallbackApplied: boolean;
  fallbackMessage: string | null;
  resolutionKey: string | null;
  priceId: string;
};

type ProviderCandidate = {
  provider: "paystack" | "flutterwave";
  providerMode: ProviderMode;
  currency: string;
  amountMinor: number;
  marketAligned: boolean;
  fallbackApplied: false;
  fallbackMessage: null;
  resolutionKey: string | null;
  priceId: null;
};

type QuoteCandidate = StripeCandidate | ProviderCandidate;

type QuoteInput = {
  role: BillingRole;
  tier: PlanTier;
  cadence: BillingCadence;
  market: Pick<ResolvedMarket, "country" | "currency">;
  stripe: {
    enabled: boolean;
    mode: ProviderMode;
    secretKey?: string | null;
  };
  paystack: {
    enabled: boolean;
    mode: ProviderMode;
  };
  flutterwave: {
    enabled: boolean;
    mode: ProviderMode;
  };
  stripePriceLoader?: (secretKey: string, priceId: string) => Promise<{ currency: string; amountMinor: number } | null>;
};

const PROVIDER_PRIORITY: SubscriptionCheckoutProvider[] = ["stripe", "paystack", "flutterwave"];
const stripePriceCache = new Map<string, Promise<{ currency: string; amountMinor: number } | null>>();

function resolveMarketLocale(country: string) {
  if (country === "GB") return "en-GB";
  if (country === "CA") return "en-CA";
  if (country === "US") return "en-US";
  return "en-NG";
}

async function fetchStripePriceSnapshot(secretKey: string, priceId: string) {
  const cacheKey = `${secretKey}:${priceId}`;
  if (!stripePriceCache.has(cacheKey)) {
    stripePriceCache.set(
      cacheKey,
      (async () => {
        try {
          const stripe = getStripeClient(secretKey);
          const price = await stripe.prices.retrieve(priceId);
          if (!price.active) return null;
          const amountMinor =
            typeof price.unit_amount === "number"
              ? price.unit_amount
              : price.unit_amount_decimal
              ? Math.round(Number(price.unit_amount_decimal))
              : null;
          if (!amountMinor || amountMinor < 0) return null;
          return {
            currency: String(price.currency || "").toUpperCase(),
            amountMinor,
          };
        } catch {
          return null;
        }
      })()
    );
  }
  return stripePriceCache.get(cacheKey) ?? Promise.resolve(null);
}

async function resolveStripeCandidate(input: QuoteInput): Promise<StripeCandidate | null> {
  if (!input.stripe.enabled || !input.stripe.secretKey) return null;
  const selection = resolveStripePriceSelection(
    input.role,
    input.tier,
    input.cadence,
    input.stripe.mode,
    input.market.currency
  );
  if (!selection.priceId) return null;
  const snapshot = await (input.stripePriceLoader || fetchStripePriceSnapshot)(
    input.stripe.secretKey,
    selection.priceId
  );
  if (!snapshot?.currency) return null;
  const marketAligned = snapshot.currency === input.market.currency;
  return {
    provider: "stripe",
    providerMode: input.stripe.mode,
    currency: snapshot.currency,
    amountMinor: snapshot.amountMinor,
    marketAligned,
    fallbackApplied: !marketAligned,
    fallbackMessage: marketAligned
      ? null
      : `No ${input.market.currency} Stripe price is configured yet. Checkout will charge in ${snapshot.currency}.`,
    resolutionKey: selection.envKey,
    priceId: selection.priceId,
  };
}

function resolveLocalProviderCandidate(
  provider: "paystack" | "flutterwave",
  mode: ProviderMode,
  enabled: boolean,
  input: QuoteInput
): ProviderCandidate | null {
  if (!enabled) return null;
  const pricing = resolveProviderPricing({
    provider,
    role: input.role,
    tier: input.tier,
    cadence: input.cadence,
    currency: input.market.currency,
  });
  if (!pricing) return null;
  return {
    provider,
    providerMode: mode,
    currency: pricing.currency,
    amountMinor: pricing.amountMinor,
    marketAligned: pricing.currency === input.market.currency,
    fallbackApplied: false,
    fallbackMessage: null,
    resolutionKey: pricing.resolutionKey,
    priceId: null,
  };
}

function pickBestCandidate(candidates: QuoteCandidate[]) {
  const sorted = [...candidates].sort((a, b) => {
    if (a.marketAligned !== b.marketAligned) {
      return a.marketAligned ? -1 : 1;
    }
    return PROVIDER_PRIORITY.indexOf(a.provider) - PROVIDER_PRIORITY.indexOf(b.provider);
  });
  return sorted[0] ?? null;
}

function buildUnavailableQuote(input: QuoteInput, reason: string): SubscriptionPlanPricingView {
  return {
    status: "unavailable",
    provider: null,
    providerMode: null,
    currency: null,
    amountMinor: null,
    displayPrice: "Unavailable",
    cadence: input.cadence,
    marketCountry: input.market.country,
    marketCurrency: input.market.currency,
    marketLabel: formatMarketLabel(input.market),
    marketAligned: false,
    fallbackApplied: false,
    fallbackMessage: null,
    unavailableReason: reason,
    resolutionKey: null,
    priceId: null,
  };
}

function buildReadyQuote(input: QuoteInput, candidate: QuoteCandidate): SubscriptionPlanPricingView {
  return {
    status: "ready",
    provider: candidate.provider,
    providerMode: candidate.providerMode,
    currency: candidate.currency,
    amountMinor: candidate.amountMinor,
    displayPrice: formatCurrencyMinor(candidate.currency, candidate.amountMinor, {
      locale: resolveMarketLocale(input.market.country),
    }),
    cadence: input.cadence,
    marketCountry: input.market.country,
    marketCurrency: input.market.currency,
    marketLabel: formatMarketLabel(input.market),
    marketAligned: candidate.marketAligned,
    fallbackApplied: candidate.fallbackApplied,
    fallbackMessage: candidate.fallbackMessage,
    unavailableReason: null,
    resolutionKey: candidate.resolutionKey,
    priceId: candidate.priceId,
  };
}

export async function resolveSubscriptionPlanQuote(
  input: QuoteInput
): Promise<SubscriptionPlanPricingView> {
  const candidates = (
    await Promise.all([
      resolveStripeCandidate(input),
      Promise.resolve(
        resolveLocalProviderCandidate("paystack", input.paystack.mode, input.paystack.enabled, input)
      ),
      Promise.resolve(
        resolveLocalProviderCandidate(
          "flutterwave",
          input.flutterwave.mode,
          input.flutterwave.enabled,
          input
        )
      ),
    ])
  ).filter((candidate): candidate is QuoteCandidate => Boolean(candidate));

  const best = pickBestCandidate(candidates);
  if (!best) {
    return buildUnavailableQuote(
      input,
      `No ${input.market.currency} subscription price is configured for ${formatMarketLabel(
        input.market
      )}.`
    );
  }

  return buildReadyQuote(input, best);
}

export function resolveYearlySavingsLabel(pricing: SubscriptionPlanPricingSet) {
  if (pricing.monthly.status !== "ready" || pricing.yearly.status !== "ready") return null;
  if (!pricing.monthly.amountMinor || !pricing.yearly.amountMinor) return null;
  if (pricing.monthly.currency !== pricing.yearly.currency) return null;
  const yearlyFromMonthly = pricing.monthly.amountMinor * 12;
  if (yearlyFromMonthly <= 0 || pricing.yearly.amountMinor >= yearlyFromMonthly) return null;
  const discount = Math.round(((yearlyFromMonthly - pricing.yearly.amountMinor) / yearlyFromMonthly) * 100);
  return discount > 0 ? `Save ${discount}%` : null;
}
