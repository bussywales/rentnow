import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanadaRentalPaygFuturePaymentRecordContract } from "@/lib/billing/canada-payg-webhook-contract.server";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const CANADA_PAYG_PAYMENT_PERSISTENCE_ENABLED = false as const;

export type CanadaListingPaymentInsertPayload = {
  user_id: string;
  listing_id: string;
  amount: number;
  currency: "CAD";
  status: "paid";
  provider: "stripe";
  provider_ref: string;
  idempotency_key: string;
  paid_at: string;
  created_at: string;
  updated_at: string;
};

export type CanadaListingPaymentPersistenceValidationResult =
  | {
      ok: true;
      warnings: string[];
    }
  | {
      ok: false;
      reason:
        | "WRONG_TABLE"
        | "WRITE_ALREADY_ENABLED"
        | "WRONG_MARKET"
        | "WRONG_PROVIDER"
        | "WRONG_CURRENCY"
        | "WRONG_PURPOSE"
        | "INVALID_AMOUNT"
        | "MISSING_LISTING_ID"
        | "MISSING_OWNER_ID"
        | "MISSING_IDEMPOTENCY_KEY"
        | "MISSING_PROVIDER_REFERENCE";
      warnings: string[];
    };

export type CanadaListingPaymentPersistenceDisabledResult = {
  enabled: false;
  wouldInsert: true;
  inserted: false;
  payload: CanadaListingPaymentInsertPayload;
  validation: Extract<CanadaListingPaymentPersistenceValidationResult, { ok: true }>;
  stripeReferences: {
    checkoutSessionId: string | null;
    paymentIntentId: string | null;
    stripeEventId: string | null;
    canonicalProviderRef: string;
  };
};

function normalizeAmountMinor(amountMinor: number | null | undefined) {
  if (typeof amountMinor !== "number" || !Number.isFinite(amountMinor)) return null;
  return Math.trunc(amountMinor);
}

function resolveCanonicalProviderRef(contract: CanadaRentalPaygFuturePaymentRecordContract) {
  return (
    contract.fields.paymentIntentId ??
    contract.fields.checkoutSessionId ??
    contract.fields.stripeEventId ??
    null
  );
}

export function validateCanadaListingPaymentPersistenceContract(
  contract: CanadaRentalPaygFuturePaymentRecordContract
): CanadaListingPaymentPersistenceValidationResult {
  if (contract.table !== "listing_payments") {
    return { ok: false, reason: "WRONG_TABLE", warnings: ["Canada PAYG payment persistence must target listing_payments."] };
  }

  if (contract.writeEnabled) {
    return { ok: false, reason: "WRITE_ALREADY_ENABLED", warnings: ["Live Canada PAYG payment persistence must stay disabled in this batch."] };
  }

  if (contract.fields.market !== "CA") {
    return { ok: false, reason: "WRONG_MARKET", warnings: ["Canada PAYG payment persistence is scoped to market CA only."] };
  }

  if (contract.fields.provider !== "stripe") {
    return { ok: false, reason: "WRONG_PROVIDER", warnings: ["Canada PAYG payment persistence is scoped to Stripe only."] };
  }

  if (contract.fields.currency !== "CAD") {
    return { ok: false, reason: "WRONG_CURRENCY", warnings: ["Canada PAYG payment persistence is scoped to CAD only."] };
  }

  if (contract.fields.purpose !== "listing_submission") {
    return { ok: false, reason: "WRONG_PURPOSE", warnings: ["Canada PAYG payment persistence is scoped to listing_submission only."] };
  }

  if (!contract.fields.listingId) {
    return { ok: false, reason: "MISSING_LISTING_ID", warnings: ["Canada PAYG payment persistence requires listing_id."] };
  }

  if (!contract.fields.ownerId) {
    return { ok: false, reason: "MISSING_OWNER_ID", warnings: ["Canada PAYG payment persistence requires owner_id for listing_payments.user_id."] };
  }

  if (!contract.fields.checkoutSessionId && !contract.fields.paymentIntentId && !contract.fields.stripeEventId) {
    return { ok: false, reason: "MISSING_PROVIDER_REFERENCE", warnings: ["Canada PAYG payment persistence requires at least one Stripe reference."] };
  }

  if (!contract.fields.idempotencyKey) {
    return { ok: false, reason: "MISSING_IDEMPOTENCY_KEY", warnings: ["Canada PAYG payment persistence requires an idempotency key for Stripe webhook replay safety."] };
  }

  const amountMinor = normalizeAmountMinor(contract.fields.amountMinor);
  if (amountMinor == null || amountMinor <= 0) {
    return { ok: false, reason: "INVALID_AMOUNT", warnings: ["Canada PAYG payment persistence requires a positive minor-unit amount."] };
  }

  const providerRef = resolveCanonicalProviderRef(contract);
  if (!providerRef) {
    return { ok: false, reason: "MISSING_PROVIDER_REFERENCE", warnings: ["Canada PAYG payment persistence needs a canonical Stripe provider reference."] };
  }

  if (!contract.fields.checkoutSessionId && !contract.fields.paymentIntentId && !contract.fields.stripeEventId) {
    return { ok: false, reason: "MISSING_PROVIDER_REFERENCE", warnings: ["Stripe webhook replay safety requires a checkout session, payment intent, or event id."] };
  }

  return {
    ok: true,
    warnings: [
      "listing_payments can store the canonical Canada Stripe provider_ref, but live insert execution remains disabled in this batch.",
      "The existing listing_payments schema does not persist every Stripe reference separately; the disabled contract keeps the full reference set in memory for future fulfilment wiring.",
    ],
  };
}

export function buildCanadaListingPaymentInsertPayload(
  contract: CanadaRentalPaygFuturePaymentRecordContract,
  paidAt = new Date().toISOString()
): CanadaListingPaymentInsertPayload {
  const validation = validateCanadaListingPaymentPersistenceContract(contract);
  if (!validation.ok) {
    throw new Error(`Invalid Canada PAYG payment persistence contract: ${validation.reason}`);
  }

  const amountMinor = normalizeAmountMinor(contract.fields.amountMinor) ?? 0;
  const canonicalProviderRef = resolveCanonicalProviderRef(contract);
  if (!canonicalProviderRef) {
    throw new Error("Invalid Canada PAYG payment persistence contract: MISSING_PROVIDER_REFERENCE");
  }

  return {
    user_id: contract.fields.ownerId!,
    listing_id: contract.fields.listingId,
    amount: amountMinor / 100,
    currency: "CAD",
    status: "paid",
    provider: "stripe",
    provider_ref: canonicalProviderRef,
    idempotency_key: contract.fields.idempotencyKey,
    paid_at: paidAt,
    created_at: paidAt,
    updated_at: paidAt,
  };
}

export async function persistCanadaListingPaymentDisabled(input: {
  contract: CanadaRentalPaygFuturePaymentRecordContract;
  client?: SupabaseClient | UntypedAdminClient | null;
  paidAt?: string;
}): Promise<CanadaListingPaymentPersistenceDisabledResult> {
  const validation = validateCanadaListingPaymentPersistenceContract(input.contract);
  if (!validation.ok) {
    throw new Error(`Invalid Canada PAYG payment persistence contract: ${validation.reason}`);
  }

  const payload = buildCanadaListingPaymentInsertPayload(input.contract, input.paidAt);
  void input.client;

  return {
    enabled: CANADA_PAYG_PAYMENT_PERSISTENCE_ENABLED,
    wouldInsert: true,
    inserted: false,
    payload,
    validation,
    stripeReferences: {
      checkoutSessionId: input.contract.fields.checkoutSessionId,
      paymentIntentId: input.contract.fields.paymentIntentId,
      stripeEventId: input.contract.fields.stripeEventId,
      canonicalProviderRef: payload.provider_ref,
    },
  };
}
