import type { BillingRole } from "@/lib/billing/stripe-plans";
import type { MarketPricingControlPlaneTier } from "@/lib/billing/market-pricing";
import type { ParsedCanadaRentalPaygStripeSuccessMetadata } from "@/lib/billing/canada-payg-stripe-session.server";
import { isRentIntent, isSaleIntent, normalizeListingIntent } from "@/lib/listing-intents";
import { isShortletProperty } from "@/lib/shortlet/discovery";

export type CanadaRentalPaygFulfilmentReasonCode =
  | "READY_FOR_DISABLED_FULFILMENT"
  | "MISSING_PARSED_METADATA"
  | "WRONG_MARKET"
  | "WRONG_PROVIDER"
  | "WRONG_PURPOSE"
  | "MISSING_LISTING_ID"
  | "LISTING_NOT_FOUND"
  | "LISTING_ID_MISMATCH"
  | "CURRENCY_NOT_CAD"
  | "INVALID_AMOUNT"
  | "TENANT_DEMAND_ONLY"
  | "ROLE_NOT_SUPPORTED"
  | "ENTERPRISE_PLANNING_ONLY"
  | "SHORTLET_EXCLUDED"
  | "SALE_DEFERRED"
  | "OFF_PLAN_DEFERRED"
  | "NON_RENTAL_LISTING"
  | "PROVIDER_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "AMOUNT_MISMATCH";

export type CanadaRentalPaygFulfilmentListingContext = {
  id: string;
  ownerId?: string | null;
  countryCode?: string | null;
  listingIntent?: string | null;
  rentalType?: string | null;
};

export type CanadaRentalPaygFulfilmentPricingExpectation = {
  amountMinor?: number | null;
  currency?: string | null;
  provider?: string | null;
};

export type CanadaRentalPaygFulfilmentValidationInput = {
  metadata: ParsedCanadaRentalPaygStripeSuccessMetadata | null;
  listing: CanadaRentalPaygFulfilmentListingContext | null;
  expectedPricing?: CanadaRentalPaygFulfilmentPricingExpectation | null;
};

export type CanadaRentalPaygFulfilmentValidationResult = {
  ok: boolean;
  reasonCode: CanadaRentalPaygFulfilmentReasonCode;
  role: BillingRole | null;
  tier: MarketPricingControlPlaneTier | null;
  listingIntent: ReturnType<typeof normalizeListingIntent>;
  isShortlet: boolean;
  metadata: ParsedCanadaRentalPaygStripeSuccessMetadata | null;
  listing: CanadaRentalPaygFulfilmentListingContext | null;
  warnings: string[];
};

export type CanadaRentalPaygFulfilmentPlannedActionKey =
  | "verify_metadata"
  | "verify_listing_context"
  | "record_payment"
  | "grant_paid_extra_entitlement"
  | "unlock_listing_submission"
  | "log_audit_event"
  | "return_to_listing_recovery";

export type CanadaRentalPaygFulfilmentPlannedAction = {
  key: CanadaRentalPaygFulfilmentPlannedActionKey;
  description: string;
  enabled: false;
};

export type CanadaRentalPaygFulfilmentPlan = {
  ready: boolean;
  reasonCode: CanadaRentalPaygFulfilmentReasonCode;
  metadata: ParsedCanadaRentalPaygStripeSuccessMetadata | null;
  listing: CanadaRentalPaygFulfilmentListingContext | null;
  paymentRecordModel: "listing_payments";
  entitlementModel: "listing_credits";
  futurePaidSlotModel: "provider-backed one-off payment plus listing-scoped extra-slot entitlement";
  actions: CanadaRentalPaygFulfilmentPlannedAction[];
  warnings: string[];
  paymentRecordWriteEnabled: false;
  entitlementGrantEnabled: false;
  listingUnlockEnabled: false;
};

export type CanadaRentalPaygFulfilmentDisabledResult = {
  enabled: false;
  wouldMutate: true;
  mutated: false;
  paymentRecordCreated: false;
  entitlementGranted: false;
  listingUnlocked: false;
  listingStatusChanged: false;
  plan: CanadaRentalPaygFulfilmentPlan;
};

function normalizeUpper(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized.length ? normalized : null;
}

function normalizeAmountMinor(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
}

function buildBlockedValidationResult(
  input: Omit<CanadaRentalPaygFulfilmentValidationResult, "ok" | "reasonCode"> & {
    reasonCode: CanadaRentalPaygFulfilmentReasonCode;
  }
): CanadaRentalPaygFulfilmentValidationResult {
  return {
    ok: false,
    reasonCode: input.reasonCode,
    role: input.role,
    tier: input.tier,
    listingIntent: input.listingIntent,
    isShortlet: input.isShortlet,
    metadata: input.metadata,
    listing: input.listing,
    warnings: input.warnings,
  };
}

export function validateCanadaRentalPaygFulfilmentInput(
  input: CanadaRentalPaygFulfilmentValidationInput
): CanadaRentalPaygFulfilmentValidationResult {
  const metadata = input.metadata;
  const listing = input.listing;
  const listingIntent = normalizeListingIntent(listing?.listingIntent);
  const isShortlet = isShortletProperty({
    listing_intent: listing?.listingIntent,
    rental_type: listing?.rentalType,
  });
  const role = metadata?.role ?? null;
  const tier = metadata?.tier ?? null;

  if (!metadata) {
    return buildBlockedValidationResult({
      reasonCode: "MISSING_PARSED_METADATA",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata: null,
      listing,
      warnings: ["Canada PAYG fulfilment requires parsed Stripe payment metadata."],
    });
  }

  if (metadata.provider !== "stripe") {
    return buildBlockedValidationResult({
      reasonCode: "WRONG_PROVIDER",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing,
      warnings: ["Canada PAYG fulfilment is scoped to Stripe one-off payments only."],
    });
  }

  if (metadata.purpose !== "listing_submission") {
    return buildBlockedValidationResult({
      reasonCode: "WRONG_PURPOSE",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing,
      warnings: ["Canada PAYG fulfilment is scoped to listing_submission only."],
    });
  }

  if (!metadata.listingId) {
    return buildBlockedValidationResult({
      reasonCode: "MISSING_LISTING_ID",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing,
      warnings: ["Canada PAYG fulfilment requires a concrete listing_id."],
    });
  }

  if (!listing) {
    return buildBlockedValidationResult({
      reasonCode: "LISTING_NOT_FOUND",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing: null,
      warnings: ["Canada PAYG fulfilment needs current listing context before any mutation can be considered."],
    });
  }

  if (metadata.market !== "CA" || normalizeUpper(listing.countryCode) !== "CA") {
    return buildBlockedValidationResult({
      reasonCode: "WRONG_MARKET",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing,
      warnings: ["Canada PAYG fulfilment is scoped to CA listings only."],
    });
  }

  if (listing.id !== metadata.listingId) {
    return buildBlockedValidationResult({
      reasonCode: "LISTING_ID_MISMATCH",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing,
      warnings: ["The Stripe metadata listing_id must match the fetched listing context."],
    });
  }

  if (metadata.currency !== "CAD") {
    return buildBlockedValidationResult({
      reasonCode: "CURRENCY_NOT_CAD",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing,
      warnings: ["Canada PAYG fulfilment requires CAD-denominated one-off payments."],
    });
  }

  if (!metadata.amountMinor || metadata.amountMinor <= 0) {
    return buildBlockedValidationResult({
      reasonCode: "INVALID_AMOUNT",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing,
      warnings: ["Canada PAYG fulfilment requires a positive minor-unit amount."],
    });
  }

  if (role === "tenant") {
    return buildBlockedValidationResult({
      reasonCode: "TENANT_DEMAND_ONLY",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing,
      warnings: ["Tenant remains demand-side only in the Canada PAYG pilot."],
    });
  }

  if (role !== "landlord" && role !== "agent") {
    return buildBlockedValidationResult({
      reasonCode: "ROLE_NOT_SUPPORTED",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing,
      warnings: ["Only landlord and agent supply-side roles are in scope for Canada PAYG fulfilment."],
    });
  }

  if (tier === "enterprise") {
    return buildBlockedValidationResult({
      reasonCode: "ENTERPRISE_PLANNING_ONLY",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing,
      warnings: ["Enterprise remains planning-only and cannot be fulfilled in runtime yet."],
    });
  }

  if (isShortlet) {
    return buildBlockedValidationResult({
      reasonCode: "SHORTLET_EXCLUDED",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing,
      warnings: ["Canada shortlets remain excluded from the rental PAYG pilot."],
    });
  }

  if (listingIntent === "off_plan") {
    return buildBlockedValidationResult({
      reasonCode: "OFF_PLAN_DEFERRED",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing,
      warnings: ["Canada off-plan remains out of scope for PAYG fulfilment."],
    });
  }

  if (isSaleIntent(listingIntent)) {
    return buildBlockedValidationResult({
      reasonCode: "SALE_DEFERRED",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing,
      warnings: ["Canada sales remain deferred and cannot use rental PAYG fulfilment."],
    });
  }

  if (!isRentIntent(listingIntent)) {
    return buildBlockedValidationResult({
      reasonCode: "NON_RENTAL_LISTING",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing,
      warnings: ["Canada PAYG fulfilment requires a rental listing intent."],
    });
  }

  const expectedProvider = normalizeUpper(input.expectedPricing?.provider ?? null);
  const expectedCurrency = normalizeUpper(input.expectedPricing?.currency ?? null);
  const expectedAmountMinor = normalizeAmountMinor(input.expectedPricing?.amountMinor ?? null);

  if (expectedProvider && expectedProvider !== "STRIPE") {
    return buildBlockedValidationResult({
      reasonCode: "PROVIDER_MISMATCH",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing,
      warnings: ["Expected Canada PAYG provider must remain Stripe."],
    });
  }

  if (expectedCurrency && expectedCurrency !== "CAD") {
    return buildBlockedValidationResult({
      reasonCode: "CURRENCY_MISMATCH",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing,
      warnings: ["Expected Canada PAYG currency must remain CAD."],
    });
  }

  if (expectedAmountMinor !== null && expectedAmountMinor !== metadata.amountMinor) {
    return buildBlockedValidationResult({
      reasonCode: "AMOUNT_MISMATCH",
      role,
      tier,
      listingIntent,
      isShortlet,
      metadata,
      listing,
      warnings: ["Stripe metadata amount must match the expected Canada PAYG one-off amount."],
    });
  }

  return {
    ok: true,
    reasonCode: "READY_FOR_DISABLED_FULFILMENT",
    role,
    tier,
    listingIntent,
    isShortlet,
    metadata,
    listing,
    warnings: [
      "Canada PAYG fulfilment is scaffolded only in this batch.",
      "No payment record, entitlement, or listing mutation is executed yet.",
    ],
  };
}

export function buildCanadaRentalPaygFulfilmentPlan(
  validation: CanadaRentalPaygFulfilmentValidationResult
): CanadaRentalPaygFulfilmentPlan {
  return {
    ready: validation.ok,
    reasonCode: validation.reasonCode,
    metadata: validation.metadata,
    listing: validation.listing,
    paymentRecordModel: "listing_payments",
    entitlementModel: "listing_credits",
    futurePaidSlotModel: "provider-backed one-off payment plus listing-scoped extra-slot entitlement",
    actions: [
      {
        key: "verify_metadata",
        description: "Verify Stripe metadata still matches the Canada listing_submission contract.",
        enabled: false,
      },
      {
        key: "verify_listing_context",
        description: "Verify the target listing is a CA rental listing and still eligible for Canada PAYG recovery.",
        enabled: false,
      },
      {
        key: "record_payment",
        description: "Create or mark a Canada one-off payment record in listing_payments for the successful Stripe payment.",
        enabled: false,
      },
      {
        key: "grant_paid_extra_entitlement",
        description: "Grant a paid extra listing entitlement or listing-scoped beyond-cap slot for the paid Canada listing.",
        enabled: false,
      },
      {
        key: "unlock_listing_submission",
        description: "Unlock submit or recovery for the specific listing without broadly bypassing active listing caps.",
        enabled: false,
      },
      {
        key: "log_audit_event",
        description: "Log audit and analytics events for the Canada PAYG fulfilment decision and recovery outcome.",
        enabled: false,
      },
      {
        key: "return_to_listing_recovery",
        description: "Return the user to the listing edit or recovery path with a Canada PAYG success marker.",
        enabled: false,
      },
    ],
    warnings: validation.warnings,
    paymentRecordWriteEnabled: false,
    entitlementGrantEnabled: false,
    listingUnlockEnabled: false,
  };
}

export function executeCanadaRentalPaygFulfilmentDisabled(
  plan: CanadaRentalPaygFulfilmentPlan
): CanadaRentalPaygFulfilmentDisabledResult {
  return {
    enabled: false,
    wouldMutate: true,
    mutated: false,
    paymentRecordCreated: false,
    entitlementGranted: false,
    listingUnlocked: false,
    listingStatusChanged: false,
    plan,
  };
}
