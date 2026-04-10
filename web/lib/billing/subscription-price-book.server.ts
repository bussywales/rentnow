import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getStripeConfigForMode } from "@/lib/billing/stripe";
import { resolveSubscriptionPlanQuote } from "@/lib/billing/subscription-pricing";
import { loadSubscriptionPriceBookRows } from "@/lib/billing/subscription-price-book.repository";
import {
  buildSubscriptionPriceMatrixEntries,
  getSubscriptionTierForRole,
  type SubscriptionPriceBookRow,
  type SubscriptionPriceBookRuntimeQuote,
} from "@/lib/billing/subscription-price-book";
import { MARKET_OPTIONS } from "@/lib/market/market";

type ProfileSummary = {
  id: string;
  full_name: string | null;
};

export type AdminSubscriptionPriceMatrixFilters = {
  market: string;
  role: string;
  cadence: string;
  provider: string;
  active: string;
  fallbackEligible: string;
};

const EMPTY_FILTERS: AdminSubscriptionPriceMatrixFilters = {
  market: "all",
  role: "all",
  cadence: "all",
  provider: "all",
  active: "all",
  fallbackEligible: "all",
};

function pickParam(
  value: string | string[] | undefined,
  fallback: string
) {
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
}

export function parseAdminSubscriptionPriceMatrixFilters(
  params: Record<string, string | string[] | undefined>
): AdminSubscriptionPriceMatrixFilters {
  return {
    market: pickParam(params.market, EMPTY_FILTERS.market).toUpperCase(),
    role: pickParam(params.role, EMPTY_FILTERS.role).toLowerCase(),
    cadence: pickParam(params.cadence, EMPTY_FILTERS.cadence).toLowerCase(),
    provider: pickParam(params.provider, EMPTY_FILTERS.provider).toLowerCase(),
    active: pickParam(params.active, EMPTY_FILTERS.active).toLowerCase(),
    fallbackEligible: pickParam(params.fallbackEligible, EMPTY_FILTERS.fallbackEligible).toLowerCase(),
  };
}

function matchesFilters(
  entry: ReturnType<typeof buildSubscriptionPriceMatrixEntries>[number],
  filters: AdminSubscriptionPriceMatrixFilters
) {
  if (filters.market !== "ALL" && entry.marketCountry !== filters.market) return false;
  if (filters.role !== "all" && entry.role !== filters.role) return false;
  if (filters.cadence !== "all" && entry.cadence !== filters.cadence) return false;
  if (filters.provider !== "all") {
    const provider = entry.canonicalProvider || entry.runtimeQuote.provider;
    if (provider !== filters.provider) return false;
  }
  if (filters.active !== "all") {
    const expected = filters.active === "active";
    if (entry.canonicalActive !== expected) return false;
  }
  if (filters.fallbackEligible !== "all") {
    const expected = filters.fallbackEligible === "yes";
    if (entry.canonicalFallbackEligible !== expected) return false;
  }
  return true;
}

async function createAdminMatrixClient() {
  if (hasServiceRoleEnv()) return createServiceRoleClient();
  if (hasServerSupabaseEnv()) return createServerSupabaseClient();
  return null;
}

async function loadCanonicalRows() {
  const client = await createAdminMatrixClient();
  const rows = await loadSubscriptionPriceBookRows();
  if (!client) return { rows, profileMap: new Map<string, string>() };

  const updatedByIds = Array.from(new Set(rows.map((row) => row.updated_by).filter(Boolean))) as string[];
  if (!updatedByIds.length) {
    return { rows, profileMap: new Map<string, string>() };
  }

  const { data: profileRows } = await client
    .from("profiles")
    .select("id, full_name")
    .in("id", updatedByIds);

  const profileMap = new Map(
    ((profileRows ?? []) as ProfileSummary[]).map((row) => [row.id, row.full_name?.trim() || row.id])
  );

  return { rows, profileMap };
}

async function loadRuntimeQuotes(canonicalRows: SubscriptionPriceBookRow[]): Promise<SubscriptionPriceBookRuntimeQuote[]> {
  const { stripeMode, paystackMode, flutterwaveMode } = await getProviderModes();
  const stripeConfig = getStripeConfigForMode(stripeMode);
  const quotes = await Promise.all(
    MARKET_OPTIONS.flatMap((market) =>
      (["tenant", "landlord", "agent"] as const).flatMap((role) =>
        (["monthly", "yearly"] as const).map(async (cadence) => ({
          marketCountry: market.country,
          marketCurrency: market.currency,
          role,
          tier: getSubscriptionTierForRole(role),
          cadence,
          quote: await resolveSubscriptionPlanQuote({
            role,
            tier: getSubscriptionTierForRole(role),
            cadence,
            market: { country: market.country, currency: market.currency },
            canonicalRows,
            stripe: {
              enabled: !!stripeConfig.secretKey,
              mode: stripeConfig.mode,
              secretKey: stripeConfig.secretKey,
            },
            paystack: {
              enabled: true,
              mode: paystackMode,
            },
            flutterwave: {
              enabled: true,
              mode: flutterwaveMode,
            },
          }),
        }))
      )
    )
  );

  return quotes;
}

export async function loadAdminSubscriptionPriceMatrix(filters: AdminSubscriptionPriceMatrixFilters) {
  const [{ rows, profileMap }, providerModes] = await Promise.all([loadCanonicalRows(), getProviderModes()]);
  const runtimeQuotes = await loadRuntimeQuotes(rows);

  const entries = buildSubscriptionPriceMatrixEntries({
    canonicalRows: rows,
    runtimeQuotes,
  }).map((entry) => ({
    ...entry,
    canonicalUpdatedBy:
      entry.canonicalUpdatedBy && profileMap.has(entry.canonicalUpdatedBy)
        ? profileMap.get(entry.canonicalUpdatedBy) || entry.canonicalUpdatedBy
        : entry.canonicalUpdatedBy,
  }));

  const filteredEntries = entries.filter((entry) => matchesFilters(entry, filters));

  const summary = {
    canonicalRows: entries.filter((entry) => entry.canonicalRow).length,
    marketGaps: entries.filter((entry) => entry.marketGap).length,
    localCurrencyPending: entries.filter((entry) => entry.diagnostics.includes("Local-currency Stripe pending")).length,
    runtimeFallbacks: entries.filter((entry) => entry.runtimeFallback).length,
    missingProviderRefs: entries.filter((entry) => entry.missingProviderRef).length,
    checkoutMismatches: entries.filter((entry) => entry.canonicalRow && !entry.checkoutMatchesCanonical).length,
    supersededRows: entries.filter((entry) => entry.supersededByNewerRow).length,
  };

  return {
    entries: filteredEntries,
    summary,
    providerModes,
  };
}
