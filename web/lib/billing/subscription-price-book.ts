import type { BillingCadence, BillingRole } from "@/lib/billing/stripe-plans";
import type { SubscriptionCheckoutProvider, SubscriptionPlanPricingView } from "@/lib/billing/subscription-pricing.types";
import type { PlanTier } from "@/lib/plans";
import { MARKET_OPTIONS, formatMarketLabel } from "@/lib/market/market";
import { formatCurrencyMinor } from "@/lib/money/multi-currency";

export type SubscriptionPriceBookProductArea = "subscriptions";
export type SubscriptionPriceBookProvider = SubscriptionCheckoutProvider;

export type SubscriptionPriceBookRow = {
  id: string;
  product_area: SubscriptionPriceBookProductArea;
  role: BillingRole;
  tier: PlanTier;
  cadence: BillingCadence;
  market_country: string;
  currency: string;
  amount_minor: number;
  provider: SubscriptionPriceBookProvider;
  provider_price_ref: string | null;
  active: boolean;
  fallback_eligible: boolean;
  effective_at: string;
  ends_at: string | null;
  display_order: number;
  badge: string | null;
  operator_notes: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type SubscriptionPriceBookRuntimeQuote = {
  marketCountry: string;
  marketCurrency: string;
  role: BillingRole;
  tier: PlanTier;
  cadence: BillingCadence;
  quote: SubscriptionPlanPricingView;
};

export type SubscriptionPriceMatrixEntry = {
  key: string;
  marketCountry: string;
  marketCurrency: string;
  marketLabel: string;
  role: BillingRole;
  roleLabel: string;
  tier: PlanTier;
  tierLabel: string;
  cadence: BillingCadence;
  canonicalRow: SubscriptionPriceBookRow | null;
  canonicalDisplayPrice: string | null;
  canonicalProvider: SubscriptionPriceBookProvider | null;
  canonicalProviderRef: string | null;
  canonicalActive: boolean;
  canonicalFallbackEligible: boolean;
  canonicalEffectiveAt: string | null;
  canonicalUpdatedAt: string | null;
  canonicalUpdatedBy: string | null;
  runtimeQuote: SubscriptionPlanPricingView;
  runtimeSource: SubscriptionPlanPricingView["source"];
  checkoutMatchesCanonical: boolean;
  missingProviderRef: boolean;
  marketGap: boolean;
  runtimeFallback: boolean;
  supersededByNewerRow: boolean;
  diagnostics: string[];
};

const PRICE_BOOK_LOCALE_BY_COUNTRY: Record<string, string> = {
  GB: "en-GB",
  NG: "en-NG",
  CA: "en-CA",
  US: "en-US",
};

export const SUBSCRIPTION_PRICE_BOOK_FILTER_OPTIONS = {
  markets: MARKET_OPTIONS,
  roles: ["tenant", "landlord", "agent"] as BillingRole[],
  cadences: ["monthly", "yearly"] as BillingCadence[],
  providers: ["stripe", "paystack", "flutterwave"] as SubscriptionPriceBookProvider[],
};

export function getSubscriptionTierForRole(role: BillingRole): PlanTier {
  return role === "tenant" ? "tenant_pro" : "pro";
}

export function getSubscriptionRoleLabel(role: BillingRole) {
  if (role === "tenant") return "Tenant";
  if (role === "landlord") return "Landlord";
  return "Agent";
}

export function getSubscriptionTierLabel(tier: PlanTier) {
  if (tier === "tenant_pro") return "Tenant Pro";
  if (tier === "starter") return "Starter";
  if (tier === "pro") return "Pro";
  return "Free";
}

export function buildSubscriptionPriceBookKey(input: {
  marketCountry: string;
  role: BillingRole;
  cadence: BillingCadence;
}) {
  return `${input.marketCountry}:${input.role}:${input.cadence}`;
}

function resolvePriceBookLocale(country: string) {
  return PRICE_BOOK_LOCALE_BY_COUNTRY[country] || "en-GB";
}

function formatCanonicalPrice(row: SubscriptionPriceBookRow | null) {
  if (!row) return null;
  return formatCurrencyMinor(row.currency, row.amount_minor, {
    locale: resolvePriceBookLocale(row.market_country),
  });
}

export function selectCurrentCanonicalRow(rows: SubscriptionPriceBookRow[]) {
  const activeRows = rows.filter((row) => row.active && !row.ends_at);
  const sorted = (activeRows.length ? activeRows : rows).slice().sort((a, b) => {
    const effectiveDiff = Date.parse(b.effective_at) - Date.parse(a.effective_at);
    if (effectiveDiff !== 0) return effectiveDiff;
    return Date.parse(b.updated_at) - Date.parse(a.updated_at);
  });
  return sorted[0] || null;
}

export function buildSubscriptionPriceMatrixEntries(input: {
  canonicalRows: SubscriptionPriceBookRow[];
  runtimeQuotes: SubscriptionPriceBookRuntimeQuote[];
}) {
  const rowsByKey = new Map<string, SubscriptionPriceBookRow[]>();
  for (const row of input.canonicalRows) {
    const key = buildSubscriptionPriceBookKey({
      marketCountry: row.market_country,
      role: row.role,
      cadence: row.cadence,
    });
    const group = rowsByKey.get(key) || [];
    group.push(row);
    rowsByKey.set(key, group);
  }

  return input.runtimeQuotes.map((runtime) => {
    const key = buildSubscriptionPriceBookKey({
      marketCountry: runtime.marketCountry,
      role: runtime.role,
      cadence: runtime.cadence,
    });
    const matchingRows = rowsByKey.get(key) || [];
    const canonicalRow = selectCurrentCanonicalRow(matchingRows);
    const supersededByNewerRow = matchingRows.length > 1;
    const marketLabel = formatMarketLabel({
      country: runtime.marketCountry,
      currency: runtime.marketCurrency,
    });
    const marketGap = !canonicalRow;
    const missingProviderRef = !!canonicalRow && !canonicalRow.provider_price_ref;

    const checkoutMatchesCanonical = Boolean(
      canonicalRow &&
        runtime.quote.status === "ready" &&
        runtime.quote.provider === canonicalRow.provider &&
        runtime.quote.currency === canonicalRow.currency &&
        runtime.quote.amountMinor === canonicalRow.amount_minor
    );

    const diagnostics: string[] = [];
    if (marketGap) diagnostics.push("Market gap");
    if (runtime.quote.source === "canonical") diagnostics.push("Canonical runtime");
    if (
      canonicalRow &&
      !canonicalRow.provider_price_ref &&
      runtime.quote.status === "ready" &&
      runtime.quote.source === "canonical"
    ) {
      diagnostics.push("Legacy provider ref fallback");
    }
    if (runtime.quote.fallbackApplied) diagnostics.push("Runtime fallback");
    if (missingProviderRef) diagnostics.push("Missing provider ref");
    if (canonicalRow && !checkoutMatchesCanonical) diagnostics.push("Checkout mismatch");
    if (supersededByNewerRow) diagnostics.push("Superseded row history");
    if (runtime.quote.status === "unavailable") diagnostics.push("Runtime unavailable");

    return {
      key,
      marketCountry: runtime.marketCountry,
      marketCurrency: runtime.marketCurrency,
      marketLabel,
      role: runtime.role,
      roleLabel: getSubscriptionRoleLabel(runtime.role),
      tier: runtime.tier,
      tierLabel: getSubscriptionTierLabel(runtime.tier),
      cadence: runtime.cadence,
      canonicalRow,
      canonicalDisplayPrice: formatCanonicalPrice(canonicalRow),
      canonicalProvider: canonicalRow?.provider || null,
      canonicalProviderRef: canonicalRow?.provider_price_ref || null,
      canonicalActive: canonicalRow?.active || false,
      canonicalFallbackEligible: canonicalRow?.fallback_eligible || false,
      canonicalEffectiveAt: canonicalRow?.effective_at || null,
      canonicalUpdatedAt: canonicalRow?.updated_at || null,
      canonicalUpdatedBy: canonicalRow?.updated_by || null,
      runtimeQuote: runtime.quote,
      runtimeSource: runtime.quote.source,
      checkoutMatchesCanonical,
      missingProviderRef,
      marketGap,
      runtimeFallback: runtime.quote.fallbackApplied,
      supersededByNewerRow,
      diagnostics,
    } satisfies SubscriptionPriceMatrixEntry;
  });
}
