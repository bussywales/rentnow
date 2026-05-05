import type Stripe from "stripe";
import type { BillingRole } from "@/lib/billing/stripe-plans";
import type { MarketPricingControlPlaneTier } from "@/lib/billing/market-pricing";
import type { PreparedCanadaRentalPaygStripeCheckout } from "@/lib/billing/canada-payg-stripe-prep.server";

const CANADA_RENTAL_PAYG_STRIPE_SESSION_CREATION_ENABLED = false as const;

export type CanadaRentalPaygStripeSessionBlockedReason =
  | "PREP_NOT_READY"
  | "CHECKOUT_CREATION_DISABLED";

export type CanadaRentalPaygStripeSessionInput = {
  prepared: PreparedCanadaRentalPaygStripeCheckout;
  customerEmail?: string | null;
};

export type CanadaRentalPaygStripeSessionRequest = Pick<
  Stripe.Checkout.SessionCreateParams,
  | "mode"
  | "line_items"
  | "success_url"
  | "cancel_url"
  | "metadata"
  | "payment_intent_data"
  | "customer_email"
> & {
  idempotencyKey: string;
};

export type CanadaRentalPaygStripeSessionBuildResult = {
  ready: boolean;
  blockedReason: CanadaRentalPaygStripeSessionBlockedReason | null;
  request: CanadaRentalPaygStripeSessionRequest | null;
  checkoutCreationEnabled: false;
  stripeSessionCreationAttempted: false;
  idempotencyKey: string | null;
};

export type CanadaRentalPaygRecoveryParseError =
  | "MISSING_METADATA"
  | "WRONG_MARKET"
  | "WRONG_PROVIDER"
  | "WRONG_PURPOSE"
  | "MISSING_LISTING_ID"
  | "ENTERPRISE_PLANNING_ONLY";

export type ParsedCanadaRentalPaygStripeSuccessMetadata = {
  purpose: "listing_submission";
  market: "CA";
  provider: "stripe";
  listingId: string;
  ownerId: string | null;
  payerUserId: string | null;
  role: BillingRole | null;
  tier: MarketPricingControlPlaneTier | null;
  productCode: "listing_submission" | null;
  currency: "CAD" | null;
  amountMinor: number | null;
};

export type CanadaRentalPaygRecoveryScaffoldResult =
  | {
      ok: true;
      status: "scaffolded_not_live";
      readyForFulfilment: false;
      metadata: ParsedCanadaRentalPaygStripeSuccessMetadata;
      warnings: string[];
    }
  | {
      ok: false;
      error: CanadaRentalPaygRecoveryParseError;
      readyForFulfilment: false;
    };

function normalizeString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized.length ? normalized : null;
}

function normalizeUpper(value: unknown) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toUpperCase() : null;
}

function normalizeRole(value: unknown): BillingRole | null {
  return value === "tenant" || value === "landlord" || value === "agent" ? value : null;
}

function normalizeTier(value: unknown): MarketPricingControlPlaneTier | null {
  if (
    value === "free" ||
    value === "starter" ||
    value === "pro" ||
    value === "tenant_pro" ||
    value === "enterprise"
  ) {
    return value;
  }
  return null;
}

function normalizeAmountMinor(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.trunc(numeric));
}

export function buildCanadaRentalPaygStripeSessionRequest(
  input: CanadaRentalPaygStripeSessionInput
): CanadaRentalPaygStripeSessionBuildResult {
  if (!input.prepared.ready) {
    return {
      ready: false,
      blockedReason: "PREP_NOT_READY",
      request: null,
      idempotencyKey: null,
      checkoutCreationEnabled: false,
      stripeSessionCreationAttempted: false,
    };
  }

  return {
    ready: true,
    blockedReason: null,
    request: {
      mode: "payment",
      line_items: input.prepared.lineItems,
      success_url: input.prepared.successUrl,
      cancel_url: input.prepared.cancelUrl,
      metadata: input.prepared.metadata,
      payment_intent_data: {
        metadata: input.prepared.metadata,
      },
      customer_email: input.customerEmail ?? undefined,
      idempotencyKey: input.prepared.idempotencyKey,
    },
    idempotencyKey: input.prepared.idempotencyKey,
    checkoutCreationEnabled: false,
    stripeSessionCreationAttempted: false,
  };
}

export function createCanadaRentalPaygStripeSessionDisabled(
  input: CanadaRentalPaygStripeSessionInput
): CanadaRentalPaygStripeSessionBuildResult {
  const built = buildCanadaRentalPaygStripeSessionRequest(input);
  if (!built.ready) {
    return built;
  }

  return {
    ...built,
    ready: false,
    blockedReason: "CHECKOUT_CREATION_DISABLED",
    checkoutCreationEnabled: CANADA_RENTAL_PAYG_STRIPE_SESSION_CREATION_ENABLED,
    stripeSessionCreationAttempted: false,
  };
}

export function parseCanadaRentalPaygStripeSuccessMetadata(
  metadata?: Stripe.Metadata | Record<string, string> | null
): CanadaRentalPaygRecoveryScaffoldResult {
  if (!metadata) {
    return {
      ok: false,
      error: "MISSING_METADATA",
      readyForFulfilment: false,
    };
  }

  const market = normalizeUpper(metadata.market);
  if (market !== "CA") {
    return {
      ok: false,
      error: "WRONG_MARKET",
      readyForFulfilment: false,
    };
  }

  const provider = normalizeString(metadata.provider)?.toLowerCase();
  if (provider !== "stripe") {
    return {
      ok: false,
      error: "WRONG_PROVIDER",
      readyForFulfilment: false,
    };
  }

  const purpose = normalizeString(metadata.purpose);
  if (purpose !== "listing_submission") {
    return {
      ok: false,
      error: "WRONG_PURPOSE",
      readyForFulfilment: false,
    };
  }

  const listingId = normalizeString(metadata.listing_id);
  if (!listingId) {
    return {
      ok: false,
      error: "MISSING_LISTING_ID",
      readyForFulfilment: false,
    };
  }

  const tier = normalizeTier(metadata.tier);
  if (tier === "enterprise") {
    return {
      ok: false,
      error: "ENTERPRISE_PLANNING_ONLY",
      readyForFulfilment: false,
    };
  }

  return {
    ok: true,
    status: "scaffolded_not_live",
    readyForFulfilment: false,
    metadata: {
      purpose: "listing_submission",
      market: "CA",
      provider: "stripe",
      listingId,
      ownerId: normalizeString(metadata.owner_id),
      payerUserId: normalizeString(metadata.payer_user_id),
      role: normalizeRole(metadata.role),
      tier,
      productCode:
        normalizeString(metadata.product_code) === "listing_submission" ? "listing_submission" : null,
      currency: normalizeUpper(metadata.currency) === "CAD" ? "CAD" : null,
      amountMinor: normalizeAmountMinor(metadata.amount_minor),
    },
    warnings: [
      "Canada Stripe recovery is scaffolded only in this batch.",
      "Webhook fulfilment and entitlement unlock remain intentionally disabled.",
    ],
  };
}
