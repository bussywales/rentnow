import type { BillingRole } from "@/lib/billing/stripe-plans";
import type { CanadaRentalPaygReadinessResult } from "@/lib/billing/canada-payg-readiness.server";
import type {
  MarketBillingProvider,
  MarketPricingControlPlaneTier,
  MarketOneOffProductCode,
} from "@/lib/billing/market-pricing";
import { buildHostPropertyEditHref } from "@/lib/routing/dashboard-properties-legacy";

export type CanadaRentalPaygStripePrepBlockedReason =
  | "READINESS_NOT_ACTIVATION_ALLOWED"
  | "PROVIDER_NOT_STRIPE"
  | "CURRENCY_NOT_CAD"
  | "MARKET_NOT_CA"
  | "INVALID_AMOUNT"
  | "ENTERPRISE_PLANNING_ONLY";

export type CanadaRentalPaygStripePrepInput = {
  listingId: string;
  ownerId: string;
  userId: string;
  role: BillingRole | null;
  tier: MarketPricingControlPlaneTier | null;
  amountMinor: number | null;
  currency: string | null;
  provider: MarketBillingProvider | null;
  marketCountry: string | null;
  readiness: CanadaRentalPaygReadinessResult;
  successUrlBase: string;
  cancelUrlBase: string;
  idempotencyKey?: string | null;
  productCode?: MarketOneOffProductCode;
};

export type PreparedCanadaRentalPaygStripeCheckout = {
  ready: boolean;
  blockedReason: CanadaRentalPaygStripePrepBlockedReason | null;
  amountMinor: number | null;
  currency: "CAD" | null;
  provider: "stripe" | null;
  mode: "payment";
  lineItems: Array<{
    quantity: 1;
    price_data: {
      currency: "cad";
      unit_amount: number;
      product_data: {
        name: string;
        description: string;
      };
    };
  }>;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  checkoutCreationEnabled: false;
};

function normalizeUpper(value?: string | null) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized.length ? normalized : null;
}

function buildPreparedListingUrl(baseUrl: string, listingId: string, phase: "success" | "cancel") {
  return `${baseUrl}${buildHostPropertyEditHref(listingId, {
    payment: "canada_payg",
    canada_payg: phase,
    provider: "stripe",
    market: "CA",
  })}`;
}

function buildIdempotencyKey(input: CanadaRentalPaygStripePrepInput) {
  if (input.idempotencyKey && input.idempotencyKey.trim().length >= 8) {
    return input.idempotencyKey.trim();
  }
  return [
    "ca",
    "listing_submission",
    input.listingId,
    input.userId,
    input.role ?? "unknown",
    input.tier ?? "unknown",
    String(input.amountMinor ?? "unknown"),
  ].join(":");
}

export function prepareCanadaRentalPaygStripeCheckout(
  input: CanadaRentalPaygStripePrepInput
): PreparedCanadaRentalPaygStripeCheckout {
  const productCode = input.productCode ?? "listing_submission";
  const provider = normalizeUpper(input.provider);
  const currency = normalizeUpper(input.currency);
  const marketCountry = normalizeUpper(input.marketCountry);
  const amountMinor =
    typeof input.amountMinor === "number" && Number.isFinite(input.amountMinor)
      ? Math.max(0, Math.trunc(input.amountMinor))
      : null;
  const idempotencyKey = buildIdempotencyKey(input);
  const successUrl = buildPreparedListingUrl(input.successUrlBase, input.listingId, "success");
  const cancelUrl = buildPreparedListingUrl(input.cancelUrlBase, input.listingId, "cancel");

  let blockedReason: CanadaRentalPaygStripePrepBlockedReason | null = null;
  if (!input.readiness.runtimeActivationAllowed) {
    blockedReason = "READINESS_NOT_ACTIVATION_ALLOWED";
  } else if (marketCountry !== "CA") {
    blockedReason = "MARKET_NOT_CA";
  } else if (input.tier === "enterprise" || input.readiness.reasonCode === "ENTERPRISE_PLANNING_ONLY") {
    blockedReason = "ENTERPRISE_PLANNING_ONLY";
  } else if (provider !== "STRIPE") {
    blockedReason = "PROVIDER_NOT_STRIPE";
  } else if (currency !== "CAD") {
    blockedReason = "CURRENCY_NOT_CAD";
  } else if (amountMinor === null || amountMinor <= 0) {
    blockedReason = "INVALID_AMOUNT";
  }

  const metadata: Record<string, string> = {
    purpose: "listing_submission",
    market: "CA",
    listing_id: input.listingId,
    owner_id: input.ownerId,
    payer_user_id: input.userId,
    role: input.role ?? "unknown",
    tier: input.tier ?? "unknown",
    product_code: productCode,
    pricing_source: "market_one_off_price_book",
    provider: "stripe",
    currency: "CAD",
    amount_minor: String(amountMinor ?? ""),
    checkout_enabled: "false",
  };

  return {
    ready: blockedReason === null,
    blockedReason,
    amountMinor,
    currency: currency === "CAD" ? "CAD" : null,
    provider: provider === "STRIPE" ? "stripe" : null,
    mode: "payment",
    lineItems:
      amountMinor && amountMinor > 0
        ? [
            {
              quantity: 1 as const,
              price_data: {
                currency: "cad" as const,
                unit_amount: amountMinor,
                product_data: {
                  name: "Canada rental listing submission",
                  description: `One-off Canada rental listing submission for ${input.role ?? "unknown"} ${input.tier ?? "unknown"}`,
                },
              },
            },
          ]
        : [],
    metadata,
    successUrl,
    cancelUrl,
    idempotencyKey,
    checkoutCreationEnabled: false,
  };
}
