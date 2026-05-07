import type Stripe from "stripe";
import type { BillingRole } from "@/lib/billing/stripe-plans";
import type { MarketPricingControlPlaneTier } from "@/lib/billing/market-pricing";
import {
  buildCanadaRentalPaygFulfilmentPlan,
  executeCanadaRentalPaygFulfilmentDisabled,
  executeCanadaRentalPaygFulfilmentPayloadsDisabled,
  validateCanadaRentalPaygFulfilmentInput,
  type CanadaRentalPaygFulfilmentDisabledResult,
  type CanadaRentalPaygFulfilmentListingContext,
  type CanadaRentalPaygFulfilmentPlan,
  type CanadaRentalPaygFulfilmentPayloadsDisabledResult,
  type CanadaRentalPaygFulfilmentPricingExpectation,
  type CanadaRentalPaygFulfilmentReasonCode,
  type CanadaRentalPaygFulfilmentValidationResult,
} from "@/lib/billing/canada-payg-fulfilment.server";
import {
  parseCanadaRentalPaygStripeSuccessMetadata,
  type CanadaRentalPaygRecoveryParseError,
  type ParsedCanadaRentalPaygStripeSuccessMetadata,
} from "@/lib/billing/canada-payg-stripe-session.server";

export type CanadaRentalPaygWebhookContractReasonCode =
  | "READY_FOR_DISABLED_WEBHOOK_CONTRACT"
  | "UNSUPPORTED_EVENT_TYPE"
  | CanadaRentalPaygRecoveryParseError
  | CanadaRentalPaygFulfilmentReasonCode;

export type CanadaRentalPaygWebhookContractInput = {
  event: Pick<Stripe.Event, "type" | "id" | "data">;
  listing: CanadaRentalPaygFulfilmentListingContext | null;
  expectedPricing?: CanadaRentalPaygFulfilmentPricingExpectation | null;
  checkoutSessionId?: string | null;
  paymentIntentId?: string | null;
};

export type CanadaRentalPaygFuturePaymentRecordContract = {
  kind: "canada_listing_submission_payment_record";
  table: "listing_payments";
  writeEnabled: false;
  wouldInsert: true;
  inserted: false;
  source: "stripe_checkout_session_completed";
  fields: {
    listingId: string;
    ownerId: string | null;
    payerUserId: string | null;
    purpose: "listing_submission";
    market: "CA";
    provider: "stripe";
    currency: "CAD";
    amountMinor: number;
    role: BillingRole | null;
    tier: Exclude<MarketPricingControlPlaneTier, "enterprise"> | null;
    productCode: "listing_submission" | null;
    checkoutSessionId: string | null;
    paymentIntentId: string | null;
    stripeEventId: string | null;
    idempotencyKey: string;
    status: "succeeded";
    pricingSource: "market_one_off_price_book";
  };
};

export type CanadaRentalPaygFutureEntitlementGrantContract = {
  kind: "canada_listing_scoped_extra_slot_entitlement";
  table: "canada_listing_payg_entitlements";
  schemaRequired: false;
  grantEnabled: false;
  wouldInsert: true;
  inserted: false;
  source: "stripe_checkout_session_completed";
  fields: {
    listingId: string;
    ownerId: string | null;
    marketCountry: "CA";
    provider: "stripe";
    purpose: "listing_submission";
    role: Exclude<BillingRole, "tenant"> | null;
    tier: Exclude<MarketPricingControlPlaneTier, "enterprise" | "starter" | "tenant_pro"> | null;
    amountMinor: number;
    currency: "CAD";
    sourceCheckoutSessionId: string | null;
    sourcePaymentIntentId: string | null;
    sourceStripeEventId: string | null;
    idempotencyKey: string;
    status: "granted";
    active: true;
    entitlementScope: "listing_scoped_extra_slot";
    unlockTarget: "listing_submission_recovery";
  };
};

export type CanadaRentalPaygWebhookContractValidationResult =
  | {
      ok: true;
      reasonCode: "READY_FOR_DISABLED_WEBHOOK_CONTRACT";
      eventType: "checkout.session.completed";
      parsedMetadata: ParsedCanadaRentalPaygStripeSuccessMetadata;
      fulfilmentValidation: CanadaRentalPaygFulfilmentValidationResult & { ok: true };
      warnings: string[];
    }
  | {
      ok: false;
      reasonCode: Exclude<CanadaRentalPaygWebhookContractReasonCode, "READY_FOR_DISABLED_WEBHOOK_CONTRACT">;
      eventType: string;
      parsedMetadata: ParsedCanadaRentalPaygStripeSuccessMetadata | null;
      fulfilmentValidation: CanadaRentalPaygFulfilmentValidationResult | null;
      warnings: string[];
    };

export type CanadaRentalPaygWebhookContractDisabledResult = {
  enabled: false;
  liveWebhookFulfilmentEnabled: false;
  wouldMutate: true;
  mutated: false;
  paymentRecordCreated: false;
  entitlementGranted: false;
  listingUnlocked: false;
  listingStatusChanged: false;
  fulfilmentPlan: CanadaRentalPaygFulfilmentPlan;
  fulfilmentExecution: CanadaRentalPaygFulfilmentDisabledResult;
  fulfilmentWriteExecution: CanadaRentalPaygFulfilmentPayloadsDisabledResult;
  paymentContract: CanadaRentalPaygFuturePaymentRecordContract;
  entitlementContract: CanadaRentalPaygFutureEntitlementGrantContract;
};

function getEventMetadata(event: Pick<Stripe.Event, "data">) {
  const object = event.data.object as { metadata?: Stripe.Metadata | Record<string, string> | null };
  return object?.metadata ?? null;
}

function getEventObjectId(event: Pick<Stripe.Event, "data">) {
  const object = event.data.object as { id?: string | null };
  const id = typeof object?.id === "string" ? object.id.trim() : "";
  return id.length ? id : null;
}

export function validateCanadaRentalPaygWebhookContract(
  input: CanadaRentalPaygWebhookContractInput
): CanadaRentalPaygWebhookContractValidationResult {
  if (input.event.type !== "checkout.session.completed") {
    return {
      ok: false,
      reasonCode: "UNSUPPORTED_EVENT_TYPE",
      eventType: input.event.type,
      parsedMetadata: null,
      fulfilmentValidation: null,
      warnings: ["Canada PAYG webhook scaffolding only models future checkout.session.completed events."],
    };
  }

  const parsed = parseCanadaRentalPaygStripeSuccessMetadata(getEventMetadata(input.event));
  if (!parsed.ok) {
    return {
      ok: false,
      reasonCode: parsed.error,
      eventType: input.event.type,
      parsedMetadata: null,
      fulfilmentValidation: null,
      warnings: ["Canada PAYG webhook scaffolding rejected the Stripe metadata contract before any mutation path."],
    };
  }

  const fulfilmentValidation = validateCanadaRentalPaygFulfilmentInput({
    metadata: parsed.metadata,
    listing: input.listing,
    expectedPricing: input.expectedPricing,
  });

  if (!fulfilmentValidation.ok) {
    return {
      ok: false,
      reasonCode: fulfilmentValidation.reasonCode,
      eventType: input.event.type,
      parsedMetadata: parsed.metadata,
      fulfilmentValidation,
      warnings: fulfilmentValidation.warnings,
    };
  }

  const readyFulfilmentValidation = fulfilmentValidation as CanadaRentalPaygFulfilmentValidationResult & {
    ok: true;
  };

  return {
    ok: true,
    reasonCode: "READY_FOR_DISABLED_WEBHOOK_CONTRACT",
    eventType: "checkout.session.completed",
    parsedMetadata: parsed.metadata,
    fulfilmentValidation: readyFulfilmentValidation,
    warnings: [
      ...parsed.warnings,
      ...readyFulfilmentValidation.warnings,
      "Webhook validation is scaffolded only. Live fulfilment stays disabled in this batch.",
    ],
  };
}

export function buildCanadaRentalPaygPaymentPersistenceContract(
  validation: Extract<CanadaRentalPaygWebhookContractValidationResult, { ok: true }>,
  input: Pick<CanadaRentalPaygWebhookContractInput, "checkoutSessionId" | "paymentIntentId" | "event">
): CanadaRentalPaygFuturePaymentRecordContract {
  const checkoutSessionId = input.checkoutSessionId ?? getEventObjectId(input.event);
  const stripeEventId = input.event.id ?? null;
  const idempotencyKey = `canada_payg_payment:${checkoutSessionId ?? input.paymentIntentId ?? stripeEventId ?? validation.parsedMetadata.listingId}`;

  return {
    kind: "canada_listing_submission_payment_record",
    table: "listing_payments",
    writeEnabled: false,
    wouldInsert: true,
    inserted: false,
    source: "stripe_checkout_session_completed",
    fields: {
      listingId: validation.parsedMetadata.listingId,
      ownerId: validation.parsedMetadata.ownerId,
      payerUserId: validation.parsedMetadata.payerUserId,
      purpose: "listing_submission",
      market: "CA",
      provider: "stripe",
      currency: "CAD",
      amountMinor: validation.parsedMetadata.amountMinor ?? 0,
      role: validation.parsedMetadata.role,
      tier:
        validation.parsedMetadata.tier && validation.parsedMetadata.tier !== "enterprise"
          ? validation.parsedMetadata.tier
          : null,
      productCode: validation.parsedMetadata.productCode,
      checkoutSessionId,
      paymentIntentId: input.paymentIntentId ?? null,
      stripeEventId,
      idempotencyKey,
      status: "succeeded",
      pricingSource: "market_one_off_price_book",
    },
  };
}

export function buildCanadaRentalPaygEntitlementGrantContract(
  validation: Extract<CanadaRentalPaygWebhookContractValidationResult, { ok: true }>,
  input: Pick<CanadaRentalPaygWebhookContractInput, "checkoutSessionId" | "paymentIntentId" | "event">
): CanadaRentalPaygFutureEntitlementGrantContract {
  const checkoutSessionId = input.checkoutSessionId ?? getEventObjectId(input.event);
  const stripeEventId = input.event.id ?? null;
  const idempotencyKey = `canada_payg_entitlement:${stripeEventId ?? checkoutSessionId ?? validation.parsedMetadata.listingId}`;

  return {
    kind: "canada_listing_scoped_extra_slot_entitlement",
    table: "canada_listing_payg_entitlements",
    schemaRequired: false,
    grantEnabled: false,
    wouldInsert: true,
    inserted: false,
    source: "stripe_checkout_session_completed",
    fields: {
      listingId: validation.parsedMetadata.listingId,
      ownerId: validation.parsedMetadata.ownerId,
      marketCountry: "CA",
      provider: "stripe",
      purpose: "listing_submission",
      role: validation.parsedMetadata.role === "tenant" ? null : validation.parsedMetadata.role,
      tier:
        validation.parsedMetadata.tier &&
        validation.parsedMetadata.tier !== "enterprise" &&
        validation.parsedMetadata.tier !== "starter" &&
        validation.parsedMetadata.tier !== "tenant_pro"
          ? validation.parsedMetadata.tier
          : null,
      amountMinor: validation.parsedMetadata.amountMinor ?? 0,
      currency: "CAD",
      sourceCheckoutSessionId: checkoutSessionId,
      sourcePaymentIntentId: input.paymentIntentId ?? null,
      sourceStripeEventId: stripeEventId,
      idempotencyKey,
      status: "granted",
      active: true,
      entitlementScope: "listing_scoped_extra_slot",
      unlockTarget: "listing_submission_recovery",
    },
  };
}

export function executeCanadaRentalPaygWebhookContractDisabled(
  validation: Extract<CanadaRentalPaygWebhookContractValidationResult, { ok: true }>,
  input: Pick<CanadaRentalPaygWebhookContractInput, "checkoutSessionId" | "paymentIntentId" | "event">
): CanadaRentalPaygWebhookContractDisabledResult {
  const fulfilmentPlan = buildCanadaRentalPaygFulfilmentPlan(validation.fulfilmentValidation);
  const paymentContract = buildCanadaRentalPaygPaymentPersistenceContract(validation, input);
  const entitlementContract = buildCanadaRentalPaygEntitlementGrantContract(validation, input);
  const fulfilmentWriteExecution = executeCanadaRentalPaygFulfilmentPayloadsDisabled({
    plan: fulfilmentPlan,
    paymentContract,
    entitlementContract,
  });

  return {
    enabled: false,
    liveWebhookFulfilmentEnabled: false,
    wouldMutate: true,
    mutated: false,
    paymentRecordCreated: false,
    entitlementGranted: false,
    listingUnlocked: false,
    listingStatusChanged: false,
    fulfilmentPlan,
    fulfilmentExecution: executeCanadaRentalPaygFulfilmentDisabled(fulfilmentPlan),
    fulfilmentWriteExecution,
    paymentContract,
    entitlementContract,
  };
}
