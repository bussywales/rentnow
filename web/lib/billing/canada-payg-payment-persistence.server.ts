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
  duplicate: false;
  payload: CanadaListingPaymentInsertPayload;
  validation: Extract<CanadaListingPaymentPersistenceValidationResult, { ok: true }>;
  stripeReferences: {
    checkoutSessionId: string | null;
    paymentIntentId: string | null;
    stripeEventId: string | null;
    canonicalProviderRef: string;
  };
};

export type CanadaListingPaymentPersistenceResult =
  | CanadaListingPaymentPersistenceDisabledResult
  | {
      enabled: true;
      wouldInsert: true;
      inserted: boolean;
      duplicate: boolean;
      payload: CanadaListingPaymentInsertPayload;
      validation: Extract<CanadaListingPaymentPersistenceValidationResult, { ok: true }>;
      stripeReferences: {
        checkoutSessionId: string | null;
        paymentIntentId: string | null;
        stripeEventId: string | null;
        canonicalProviderRef: string;
      };
    };

type CanadaListingPaymentLookupRow = {
  id?: string | null;
  idempotency_key?: string | null;
  provider?: string | null;
  provider_ref?: string | null;
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

async function findExistingCanadaListingPayment(input: {
  client: SupabaseClient | UntypedAdminClient;
  payload: CanadaListingPaymentInsertPayload;
}) {
  const client = input.client as UntypedAdminClient;
  const byIdempotency = await client
    .from<CanadaListingPaymentLookupRow>("listing_payments")
    .select("id,idempotency_key,provider,provider_ref")
    .eq("idempotency_key", input.payload.idempotency_key)
    .maybeSingle();

  if (byIdempotency.data) {
    return byIdempotency.data;
  }

  const byProviderRef = await client
    .from<CanadaListingPaymentLookupRow>("listing_payments")
    .select("id,idempotency_key,provider,provider_ref")
    .eq("provider", input.payload.provider)
    .eq("provider_ref", input.payload.provider_ref)
    .maybeSingle();

  return byProviderRef.data ?? null;
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
    duplicate: false,
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

export async function persistCanadaListingPayment(input: {
  contract: CanadaRentalPaygFuturePaymentRecordContract;
  client: SupabaseClient | UntypedAdminClient;
  enabled: boolean;
  paidAt?: string;
}): Promise<CanadaListingPaymentPersistenceResult> {
  const validation = validateCanadaListingPaymentPersistenceContract(input.contract);
  if (!validation.ok) {
    throw new Error(`Invalid Canada PAYG payment persistence contract: ${validation.reason}`);
  }

  if (!input.enabled) {
    return persistCanadaListingPaymentDisabled(input);
  }

  const payload = buildCanadaListingPaymentInsertPayload(input.contract, input.paidAt);
  const stripeReferences = {
    checkoutSessionId: input.contract.fields.checkoutSessionId,
    paymentIntentId: input.contract.fields.paymentIntentId,
    stripeEventId: input.contract.fields.stripeEventId,
    canonicalProviderRef: payload.provider_ref,
  };

  const existingBeforeInsert = await findExistingCanadaListingPayment({
    client: input.client,
    payload,
  });
  if (existingBeforeInsert) {
    return {
      enabled: true,
      wouldInsert: true,
      inserted: false,
      duplicate: true,
      payload,
      validation,
      stripeReferences,
    };
  }

  const adminDb = input.client as unknown as {
    from: (table: string) => {
      insert: (values: Record<string, unknown>) => Promise<{ error: { code?: string; message?: string } | null }>;
    };
  };

  const { error } = await adminDb.from("listing_payments").insert(payload);
  if (error) {
    if (error.code === "23505") {
      const existingAfterInsert = await findExistingCanadaListingPayment({
        client: input.client,
        payload,
      });
      if (existingAfterInsert) {
        return {
          enabled: true,
          wouldInsert: true,
          inserted: false,
          duplicate: true,
          payload,
          validation,
          stripeReferences,
        };
      }
    }

    throw new Error(error.message || "Canada PAYG payment persistence failed");
  }

  return {
    enabled: true,
    wouldInsert: true,
    inserted: true,
    duplicate: false,
    payload,
    validation,
    stripeReferences,
  };
}
