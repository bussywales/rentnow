import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingRole } from "@/lib/billing/stripe-plans";
import type { MarketPricingControlPlaneTier } from "@/lib/billing/market-pricing";
import type { CanadaRentalPaygFutureEntitlementGrantContract } from "@/lib/billing/canada-payg-webhook-contract.server";
import type { ActiveListingLimitGateResult } from "@/lib/plan-enforcement";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

const CANADA_PAYG_ENTITLEMENT_GRANT_ENABLED = false as const;
const CANADA_PAYG_ENTITLEMENT_CONSUME_ENABLED = false as const;

export type CanadaListingPaygEntitlementStatus = "granted" | "consumed" | "revoked" | "expired";
export type CanadaListingPaygEntitlementTier = Extract<MarketPricingControlPlaneTier, "free" | "pro">;
export type CanadaListingPaygEntitlementRole = Extract<BillingRole, "landlord" | "agent">;

export type CanadaListingPaygEntitlementRow = {
  id: string;
  listing_id: string;
  owner_id: string;
  market_country: "CA";
  provider: "stripe";
  purpose: "listing_submission";
  role: CanadaListingPaygEntitlementRole;
  tier: CanadaListingPaygEntitlementTier;
  amount_minor: number;
  currency: "CAD";
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_event_id: string | null;
  idempotency_key: string;
  status: CanadaListingPaygEntitlementStatus;
  active: boolean;
  granted_at: string | null;
  consumed_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CanadaListingPaygEntitlementInsertPayload = Omit<CanadaListingPaygEntitlementRow, "id" | "created_at" | "updated_at">;

export type CanadaListingPaygEntitlementContractValidationResult =
  | {
      ok: true;
      role: CanadaListingPaygEntitlementRole;
      tier: CanadaListingPaygEntitlementTier;
      warnings: string[];
    }
  | {
      ok: false;
      reason:
        | "WRONG_TABLE"
        | "SCHEMA_NOT_READY"
        | "WRONG_MARKET"
        | "WRONG_PROVIDER"
        | "WRONG_CURRENCY"
        | "WRONG_PURPOSE"
        | "INVALID_ROLE"
        | "INVALID_TIER"
        | "INVALID_AMOUNT"
        | "MISSING_LISTING_ID"
        | "MISSING_OWNER_ID"
        | "MISSING_IDEMPOTENCY_KEY";
      warnings: string[];
    };

export type CanadaListingPaygEntitlementGrantDisabledResult = {
  enabled: false;
  wouldInsert: true;
  inserted: false;
  duplicate: false;
  payload: CanadaListingPaygEntitlementInsertPayload;
  validation: Extract<CanadaListingPaygEntitlementContractValidationResult, { ok: true }>;
};

export type CanadaListingPaygEntitlementGrantResult =
  | CanadaListingPaygEntitlementGrantDisabledResult
  | {
      enabled: true;
      wouldInsert: true;
      inserted: boolean;
      duplicate: boolean;
      payload: CanadaListingPaygEntitlementInsertPayload;
      validation: Extract<CanadaListingPaygEntitlementContractValidationResult, { ok: true }>;
    };

export type CanadaListingPaygUnlockDecisionReasonCode =
  | "ACTIVE_ENTITLEMENT_FOUND"
  | "NO_ACTIVE_ENTITLEMENT"
  | "WRONG_MARKET"
  | "WRONG_PROVIDER"
  | "WRONG_CURRENCY"
  | "WRONG_PURPOSE"
  | "WRONG_LISTING"
  | "WRONG_OWNER"
  | "INACTIVE"
  | "CONSUMED"
  | "REVOKED"
  | "EXPIRED"
  | "WRONG_STATUS"
  | "TENANT_REJECTED"
  | "ENTERPRISE_REJECTED"
  | "INVALID_ROLE"
  | "INVALID_TIER";

export type CanadaListingPaygUnlockDecision = {
  wouldUnlock: boolean;
  reasonCode: CanadaListingPaygUnlockDecisionReasonCode;
  listingId: string;
  ownerId: string;
  entitlementId: string | null;
  scope: "listing_only";
  accountWideCapBypass: false;
  runtimeMutationEnabled: false;
};

export type CanadaListingCapBypassDecisionReasonCode =
  | "NOT_CANADA"
  | "NON_RENTAL_LISTING"
  | "SHORTLET_EXCLUDED"
  | "ACTIVE_LIMIT_NOT_REACHED"
  | "ACTIVE_LIMIT_LOOKUP_FAILED"
  | "CANADA_RUNTIME_GATE_DISABLED"
  | "CANADA_PAYG_UNLOCK_DISABLED"
  | "CANADA_PAYG_CAP_BYPASS_READY"
  | CanadaListingPaygUnlockDecisionReasonCode;

export type CanadaListingCapBypassDecision = {
  capBypassAllowed: boolean;
  reasonCode: CanadaListingCapBypassDecisionReasonCode;
  listingId: string;
  ownerId: string;
  entitlementId: string | null;
  scope: "listing_only";
  accountWideCapBypass: false;
  consumeEntitlementEnabled: false;
};

export type CanadaListingPaygEntitlementConsumeValidationResult =
  | {
      ok: true;
      warnings: string[];
    }
  | {
      ok: false;
      reason: CanadaListingPaygUnlockDecisionReasonCode;
      warnings: string[];
    };

export type CanadaListingPaygEntitlementConsumePayload = {
  entitlementId: string;
  listingId: string;
  ownerId: string;
  statusAfter: "consumed";
  activeAfter: false;
  consumedAt: string;
  metadataPatch: Record<string, unknown>;
  scope: "listing_only";
  accountWideCapBypass: false;
};

export type CanadaListingPaygEntitlementConsumeDisabledResult = {
  entitlementId: string;
  listingId: string;
  ownerId: string;
  statusAfter: "consumed";
  activeAfter: false;
  consumedAt: string;
  scope: "listing_only";
  accountWideCapBypass: false;
  mutationEnabled: false;
  mutated: false;
  payload: CanadaListingPaygEntitlementConsumePayload;
  validation: Extract<CanadaListingPaygEntitlementConsumeValidationResult, { ok: true }>;
};

function normalizeRole(role: string | null | undefined): CanadaListingPaygEntitlementRole | null {
  return role === "landlord" || role === "agent" ? role : null;
}

function normalizeTier(tier: string | null | undefined): CanadaListingPaygEntitlementTier | null {
  return tier === "free" || tier === "pro" ? tier : null;
}

function normalizeAmountMinor(amountMinor: number | null | undefined) {
  if (typeof amountMinor !== "number" || !Number.isFinite(amountMinor)) return null;
  return Math.trunc(amountMinor);
}

export function validateCanadaListingPaygEntitlementContract(
  contract: CanadaRentalPaygFutureEntitlementGrantContract
): CanadaListingPaygEntitlementContractValidationResult {
  if (contract.table !== "canada_listing_payg_entitlements") {
    return { ok: false, reason: "WRONG_TABLE", warnings: ["Entitlement contract must target canada_listing_payg_entitlements."] };
  }

  if (contract.schemaRequired) {
    return { ok: false, reason: "SCHEMA_NOT_READY", warnings: ["Entitlement schema must be present before any grant contract can be used."] };
  }

  if (contract.fields.marketCountry !== "CA") {
    return { ok: false, reason: "WRONG_MARKET", warnings: ["Canada PAYG entitlement rows are scoped to market CA only."] };
  }

  if (contract.fields.provider !== "stripe") {
    return { ok: false, reason: "WRONG_PROVIDER", warnings: ["Canada PAYG entitlement rows are scoped to Stripe only."] };
  }

  if (contract.fields.currency !== "CAD") {
    return { ok: false, reason: "WRONG_CURRENCY", warnings: ["Canada PAYG entitlement rows are scoped to CAD only."] };
  }

  if (contract.fields.purpose !== "listing_submission") {
    return { ok: false, reason: "WRONG_PURPOSE", warnings: ["Canada PAYG entitlement rows are scoped to listing_submission only."] };
  }

  if (!contract.fields.listingId) {
    return { ok: false, reason: "MISSING_LISTING_ID", warnings: ["Listing-scoped Canada PAYG entitlements require listing_id."] };
  }

  if (!contract.fields.ownerId) {
    return { ok: false, reason: "MISSING_OWNER_ID", warnings: ["Listing-scoped Canada PAYG entitlements require owner_id."] };
  }

  if (!contract.fields.idempotencyKey) {
    return { ok: false, reason: "MISSING_IDEMPOTENCY_KEY", warnings: ["Idempotency is required for Stripe replay safety."] };
  }

  const role = normalizeRole(contract.fields.role);
  if (!role) {
    return { ok: false, reason: "INVALID_ROLE", warnings: ["Canada PAYG entitlement rows support landlord or agent roles only."] };
  }

  const tier = normalizeTier(contract.fields.tier);
  if (!tier) {
    return { ok: false, reason: "INVALID_TIER", warnings: ["Canada PAYG entitlement rows exclude enterprise and unsupported tiers."] };
  }

  const amountMinor = normalizeAmountMinor(contract.fields.amountMinor);
  if (amountMinor == null || amountMinor < 0) {
    return { ok: false, reason: "INVALID_AMOUNT", warnings: ["Canada PAYG entitlement rows require a non-negative amount_minor value."] };
  }

  return {
    ok: true,
    role,
    tier,
    warnings: [
      "Canada listing-scoped entitlement storage exists, but live grant execution remains disabled in this batch.",
    ],
  };
}

export function buildCanadaListingPaygEntitlementInsertPayload(
  contract: CanadaRentalPaygFutureEntitlementGrantContract,
  grantedAt = new Date().toISOString()
): CanadaListingPaygEntitlementInsertPayload {
  const validation = validateCanadaListingPaygEntitlementContract(contract);
  if (!validation.ok) {
    throw new Error(`Invalid Canada PAYG entitlement contract: ${validation.reason}`);
  }

  return {
    listing_id: contract.fields.listingId,
    owner_id: contract.fields.ownerId!,
    market_country: "CA",
    provider: "stripe",
    purpose: "listing_submission",
    role: validation.role,
    tier: validation.tier,
    amount_minor: Math.max(0, Math.trunc(contract.fields.amountMinor)),
    currency: "CAD",
    stripe_checkout_session_id: contract.fields.sourceCheckoutSessionId,
    stripe_payment_intent_id: contract.fields.sourcePaymentIntentId,
    stripe_event_id: contract.fields.sourceStripeEventId,
    idempotency_key: contract.fields.idempotencyKey,
    status: "granted",
    active: true,
    granted_at: grantedAt,
    consumed_at: null,
    revoked_at: null,
    expires_at: null,
    metadata: {
      entitlement_scope: contract.fields.entitlementScope,
      unlock_target: contract.fields.unlockTarget,
      source: contract.source,
      inserted_by_live_runtime: false,
    },
  };
}

export async function grantCanadaListingPaygEntitlementDisabled(input: {
  contract: CanadaRentalPaygFutureEntitlementGrantContract;
  client?: SupabaseClient | UntypedAdminClient | null;
  grantedAt?: string;
}): Promise<CanadaListingPaygEntitlementGrantDisabledResult> {
  const validation = validateCanadaListingPaygEntitlementContract(input.contract);
  if (!validation.ok) {
    throw new Error(`Invalid Canada PAYG entitlement contract: ${validation.reason}`);
  }

  const payload = buildCanadaListingPaygEntitlementInsertPayload(input.contract, input.grantedAt);
  void input.client;

  return {
    enabled: CANADA_PAYG_ENTITLEMENT_GRANT_ENABLED,
    wouldInsert: true,
    inserted: false,
    duplicate: false,
    payload,
    validation,
  };
}

async function findExistingCanadaListingPaygEntitlement(input: {
  client: SupabaseClient | UntypedAdminClient;
  payload: CanadaListingPaygEntitlementInsertPayload;
}) {
  const client = input.client as UntypedAdminClient;
  const byIdempotency = await client
    .from<CanadaListingPaygEntitlementRow>("canada_listing_payg_entitlements")
    .select(
      "id,listing_id,owner_id,market_country,provider,purpose,role,tier,amount_minor,currency,stripe_checkout_session_id,stripe_payment_intent_id,stripe_event_id,idempotency_key,status,active,granted_at,consumed_at,revoked_at,expires_at,metadata,created_at,updated_at"
    )
    .eq("idempotency_key", input.payload.idempotency_key)
    .maybeSingle();

  if (byIdempotency.data) {
    return byIdempotency.data;
  }

  if (input.payload.stripe_event_id) {
    const byEventId = await client
      .from<CanadaListingPaygEntitlementRow>("canada_listing_payg_entitlements")
      .select(
        "id,listing_id,owner_id,market_country,provider,purpose,role,tier,amount_minor,currency,stripe_checkout_session_id,stripe_payment_intent_id,stripe_event_id,idempotency_key,status,active,granted_at,consumed_at,revoked_at,expires_at,metadata,created_at,updated_at"
      )
      .eq("stripe_event_id", input.payload.stripe_event_id)
      .maybeSingle();
    if (byEventId.data) return byEventId.data;
  }

  if (input.payload.stripe_payment_intent_id) {
    const byPaymentIntentId = await client
      .from<CanadaListingPaygEntitlementRow>("canada_listing_payg_entitlements")
      .select(
        "id,listing_id,owner_id,market_country,provider,purpose,role,tier,amount_minor,currency,stripe_checkout_session_id,stripe_payment_intent_id,stripe_event_id,idempotency_key,status,active,granted_at,consumed_at,revoked_at,expires_at,metadata,created_at,updated_at"
      )
      .eq("stripe_payment_intent_id", input.payload.stripe_payment_intent_id)
      .maybeSingle();
    if (byPaymentIntentId.data) return byPaymentIntentId.data;
  }

  if (input.payload.stripe_checkout_session_id) {
    const byCheckoutSessionId = await client
      .from<CanadaListingPaygEntitlementRow>("canada_listing_payg_entitlements")
      .select(
        "id,listing_id,owner_id,market_country,provider,purpose,role,tier,amount_minor,currency,stripe_checkout_session_id,stripe_payment_intent_id,stripe_event_id,idempotency_key,status,active,granted_at,consumed_at,revoked_at,expires_at,metadata,created_at,updated_at"
      )
      .eq("stripe_checkout_session_id", input.payload.stripe_checkout_session_id)
      .maybeSingle();
    if (byCheckoutSessionId.data) return byCheckoutSessionId.data;
  }

  return findActiveCanadaListingPaygEntitlement({
    client,
    listingId: input.payload.listing_id,
    ownerId: input.payload.owner_id,
  });
}

export async function grantCanadaListingPaygEntitlement(input: {
  contract: CanadaRentalPaygFutureEntitlementGrantContract;
  client: SupabaseClient | UntypedAdminClient;
  enabled: boolean;
  grantedAt?: string;
}): Promise<CanadaListingPaygEntitlementGrantResult> {
  const validation = validateCanadaListingPaygEntitlementContract(input.contract);
  if (!validation.ok) {
    throw new Error(`Invalid Canada PAYG entitlement contract: ${validation.reason}`);
  }

  if (!input.enabled) {
    return grantCanadaListingPaygEntitlementDisabled(input);
  }

  const payload = buildCanadaListingPaygEntitlementInsertPayload(input.contract, input.grantedAt);
  const existingBeforeInsert = await findExistingCanadaListingPaygEntitlement({
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
    };
  }

  const adminDb = input.client as unknown as {
    from: (table: string) => {
      insert: (values: Record<string, unknown>) => Promise<{ error: { code?: string; message?: string } | null }>;
    };
  };

  const { error } = await adminDb.from("canada_listing_payg_entitlements").insert(payload);
  if (error) {
    if (error.code === "23505") {
      const existingAfterInsert = await findExistingCanadaListingPaygEntitlement({
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
        };
      }
    }

    throw new Error(error.message || "Canada PAYG entitlement grant failed");
  }

  return {
    enabled: true,
    wouldInsert: true,
    inserted: true,
    duplicate: false,
    payload,
    validation,
  };
}

function rowHasValidActivePaidExtraSlot(row: CanadaListingPaygEntitlementRow, now = new Date()) {
  if (!row.active || row.status !== "granted") return false;
  if (row.revoked_at || row.consumed_at) return false;
  if (row.expires_at) {
    const expiresAt = Date.parse(row.expires_at);
    if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) return false;
  }
  return true;
}

export async function findActiveCanadaListingPaygEntitlement(input: {
  client: SupabaseClient | UntypedAdminClient;
  listingId: string;
  ownerId?: string | null;
  now?: Date;
}): Promise<CanadaListingPaygEntitlementRow | null> {
  const query = (input.client as UntypedAdminClient)
    .from("canada_listing_payg_entitlements")
    .select(
      "id,listing_id,owner_id,market_country,provider,purpose,role,tier,amount_minor,currency,stripe_checkout_session_id,stripe_payment_intent_id,stripe_event_id,idempotency_key,status,active,granted_at,consumed_at,revoked_at,expires_at,metadata,created_at,updated_at"
    )
    .eq("listing_id", input.listingId)
    .eq("market_country", "CA")
    .eq("provider", "stripe")
    .eq("purpose", "listing_submission")
    .eq("status", "granted")
    .eq("active", true);

  const scopedQuery = input.ownerId ? query.eq("owner_id", input.ownerId) : query;
  const { data } = await scopedQuery.order("created_at", { ascending: false });
  const rows = ((data ?? []) as CanadaListingPaygEntitlementRow[]).slice(0, 5);
  const now = input.now ?? new Date();
  return rows.find((row) => rowHasValidActivePaidExtraSlot(row, now)) ?? null;
}

export async function listingHasActiveCanadaPaygExtraSlot(input: {
  client: SupabaseClient | UntypedAdminClient;
  listingId: string;
  ownerId?: string | null;
  now?: Date;
}) {
  const row = await findActiveCanadaListingPaygEntitlement(input);
  return {
    hasActiveEntitlement: !!row,
    entitlement: row,
  };
}

export function resolveCanadaListingPaygUnlockDecisionFromRow(input: {
  entitlement: CanadaListingPaygEntitlementRow | null;
  listingId: string;
  ownerId: string;
  now?: Date;
}): CanadaListingPaygUnlockDecision {
  const { entitlement, listingId, ownerId } = input;
  const now = input.now ?? new Date();

  if (!entitlement) {
    return {
      wouldUnlock: false,
      reasonCode: "NO_ACTIVE_ENTITLEMENT",
      listingId,
      ownerId,
      entitlementId: null,
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    };
  }

  if (entitlement.listing_id !== listingId) {
    return {
      wouldUnlock: false,
      reasonCode: "WRONG_LISTING",
      listingId,
      ownerId,
      entitlementId: entitlement.id,
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    };
  }

  if (entitlement.owner_id !== ownerId) {
    return {
      wouldUnlock: false,
      reasonCode: "WRONG_OWNER",
      listingId,
      ownerId,
      entitlementId: entitlement.id,
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    };
  }

  if (entitlement.market_country !== "CA") {
    return {
      wouldUnlock: false,
      reasonCode: "WRONG_MARKET",
      listingId,
      ownerId,
      entitlementId: entitlement.id,
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    };
  }

  if (entitlement.provider !== "stripe") {
    return {
      wouldUnlock: false,
      reasonCode: "WRONG_PROVIDER",
      listingId,
      ownerId,
      entitlementId: entitlement.id,
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    };
  }

  if (entitlement.currency !== "CAD") {
    return {
      wouldUnlock: false,
      reasonCode: "WRONG_CURRENCY",
      listingId,
      ownerId,
      entitlementId: entitlement.id,
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    };
  }

  if (entitlement.purpose !== "listing_submission") {
    return {
      wouldUnlock: false,
      reasonCode: "WRONG_PURPOSE",
      listingId,
      ownerId,
      entitlementId: entitlement.id,
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    };
  }

  const role = String(entitlement.role);
  const tier = String(entitlement.tier);

  if (role === "tenant") {
    return {
      wouldUnlock: false,
      reasonCode: "TENANT_REJECTED",
      listingId,
      ownerId,
      entitlementId: entitlement.id,
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    };
  }

  if (role !== "landlord" && role !== "agent") {
    return {
      wouldUnlock: false,
      reasonCode: "INVALID_ROLE",
      listingId,
      ownerId,
      entitlementId: entitlement.id,
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    };
  }

  if (tier === "enterprise") {
    return {
      wouldUnlock: false,
      reasonCode: "ENTERPRISE_REJECTED",
      listingId,
      ownerId,
      entitlementId: entitlement.id,
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    };
  }

  if (tier !== "free" && tier !== "pro") {
    return {
      wouldUnlock: false,
      reasonCode: "INVALID_TIER",
      listingId,
      ownerId,
      entitlementId: entitlement.id,
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    };
  }

  if (entitlement.status !== "granted") {
    return {
      wouldUnlock: false,
      reasonCode: "WRONG_STATUS",
      listingId,
      ownerId,
      entitlementId: entitlement.id,
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    };
  }

  if (!entitlement.active) {
    return {
      wouldUnlock: false,
      reasonCode: "INACTIVE",
      listingId,
      ownerId,
      entitlementId: entitlement.id,
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    };
  }

  if (entitlement.consumed_at) {
    return {
      wouldUnlock: false,
      reasonCode: "CONSUMED",
      listingId,
      ownerId,
      entitlementId: entitlement.id,
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    };
  }

  if (entitlement.revoked_at) {
    return {
      wouldUnlock: false,
      reasonCode: "REVOKED",
      listingId,
      ownerId,
      entitlementId: entitlement.id,
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    };
  }

  if (entitlement.expires_at) {
    const expiresAt = Date.parse(entitlement.expires_at);
    if (Number.isFinite(expiresAt) && expiresAt <= now.getTime()) {
      return {
        wouldUnlock: false,
        reasonCode: "EXPIRED",
        listingId,
        ownerId,
        entitlementId: entitlement.id,
        scope: "listing_only",
        accountWideCapBypass: false,
        runtimeMutationEnabled: false,
      };
    }
  }

  return {
    wouldUnlock: true,
    reasonCode: "ACTIVE_ENTITLEMENT_FOUND",
    listingId,
    ownerId,
    entitlementId: entitlement.id,
    scope: "listing_only",
    accountWideCapBypass: false,
    runtimeMutationEnabled: false,
  };
}

export async function resolveCanadaListingPaygUnlockDecision(input: {
  client: SupabaseClient | UntypedAdminClient;
  listingId: string;
  ownerId: string;
  now?: Date;
}): Promise<CanadaListingPaygUnlockDecision> {
  const entitlement = await findActiveCanadaListingPaygEntitlement({
    client: input.client,
    listingId: input.listingId,
    ownerId: input.ownerId,
    now: input.now,
  });

  return resolveCanadaListingPaygUnlockDecisionFromRow({
    entitlement,
    listingId: input.listingId,
    ownerId: input.ownerId,
    now: input.now,
  });
}

export function resolveCanadaListingCapBypassDecision(input: {
  marketCountry: string | null | undefined;
  listingIntent?: string | null;
  rentalType?: string | null;
  activeLimit: ActiveListingLimitGateResult;
  runtimeGateEnabled: boolean;
  unlockGateEnabled: boolean;
  entitlementDecision: CanadaListingPaygUnlockDecision;
}): CanadaListingCapBypassDecision {
  const marketCountry = input.marketCountry?.toUpperCase() ?? null;
  const listingIntent = input.listingIntent?.toLowerCase().trim() ?? null;
  const rentalType = input.rentalType?.toLowerCase().trim() ?? null;

  if (marketCountry !== "CA") {
    return {
      capBypassAllowed: false,
      reasonCode: "NOT_CANADA",
      listingId: input.entitlementDecision.listingId,
      ownerId: input.entitlementDecision.ownerId,
      entitlementId: input.entitlementDecision.entitlementId,
      scope: "listing_only",
      accountWideCapBypass: false,
      consumeEntitlementEnabled: false,
    };
  }

  if (listingIntent !== "rent") {
    return {
      capBypassAllowed: false,
      reasonCode: "NON_RENTAL_LISTING",
      listingId: input.entitlementDecision.listingId,
      ownerId: input.entitlementDecision.ownerId,
      entitlementId: input.entitlementDecision.entitlementId,
      scope: "listing_only",
      accountWideCapBypass: false,
      consumeEntitlementEnabled: false,
    };
  }

  if (rentalType === "short_let" || rentalType === "shortlet") {
    return {
      capBypassAllowed: false,
      reasonCode: "SHORTLET_EXCLUDED",
      listingId: input.entitlementDecision.listingId,
      ownerId: input.entitlementDecision.ownerId,
      entitlementId: input.entitlementDecision.entitlementId,
      scope: "listing_only",
      accountWideCapBypass: false,
      consumeEntitlementEnabled: false,
    };
  }

  if (input.activeLimit.ok) {
    return {
      capBypassAllowed: false,
      reasonCode: "ACTIVE_LIMIT_NOT_REACHED",
      listingId: input.entitlementDecision.listingId,
      ownerId: input.entitlementDecision.ownerId,
      entitlementId: input.entitlementDecision.entitlementId,
      scope: "listing_only",
      accountWideCapBypass: false,
      consumeEntitlementEnabled: false,
    };
  }

  if (input.activeLimit.usage.error) {
    return {
      capBypassAllowed: false,
      reasonCode: "ACTIVE_LIMIT_LOOKUP_FAILED",
      listingId: input.entitlementDecision.listingId,
      ownerId: input.entitlementDecision.ownerId,
      entitlementId: input.entitlementDecision.entitlementId,
      scope: "listing_only",
      accountWideCapBypass: false,
      consumeEntitlementEnabled: false,
    };
  }

  if (!input.runtimeGateEnabled) {
    return {
      capBypassAllowed: false,
      reasonCode: "CANADA_RUNTIME_GATE_DISABLED",
      listingId: input.entitlementDecision.listingId,
      ownerId: input.entitlementDecision.ownerId,
      entitlementId: input.entitlementDecision.entitlementId,
      scope: "listing_only",
      accountWideCapBypass: false,
      consumeEntitlementEnabled: false,
    };
  }

  if (!input.unlockGateEnabled) {
    return {
      capBypassAllowed: false,
      reasonCode: "CANADA_PAYG_UNLOCK_DISABLED",
      listingId: input.entitlementDecision.listingId,
      ownerId: input.entitlementDecision.ownerId,
      entitlementId: input.entitlementDecision.entitlementId,
      scope: "listing_only",
      accountWideCapBypass: false,
      consumeEntitlementEnabled: false,
    };
  }

  if (!input.entitlementDecision.wouldUnlock) {
    return {
      capBypassAllowed: false,
      reasonCode: input.entitlementDecision.reasonCode,
      listingId: input.entitlementDecision.listingId,
      ownerId: input.entitlementDecision.ownerId,
      entitlementId: input.entitlementDecision.entitlementId,
      scope: "listing_only",
      accountWideCapBypass: false,
      consumeEntitlementEnabled: false,
    };
  }

  return {
    capBypassAllowed: true,
    reasonCode: "CANADA_PAYG_CAP_BYPASS_READY",
    listingId: input.entitlementDecision.listingId,
    ownerId: input.entitlementDecision.ownerId,
    entitlementId: input.entitlementDecision.entitlementId,
    scope: "listing_only",
    accountWideCapBypass: false,
    consumeEntitlementEnabled: false,
  };
}

export function validateCanadaListingPaygEntitlementConsume(input: {
  entitlement: CanadaListingPaygEntitlementRow | null;
  listingId: string;
  ownerId: string;
  now?: Date;
}): CanadaListingPaygEntitlementConsumeValidationResult {
  const decision = resolveCanadaListingPaygUnlockDecisionFromRow({
    entitlement: input.entitlement,
    listingId: input.listingId,
    ownerId: input.ownerId,
    now: input.now,
  });

  if (!decision.wouldUnlock) {
    return {
      ok: false,
      reason: decision.reasonCode,
      warnings: ["Canada PAYG entitlement consumption remains listing-scoped and disabled in this batch."],
    };
  }

  return {
    ok: true,
    warnings: [
      "Canada PAYG entitlement consumption contract is defined, but live consume execution remains disabled in this batch.",
    ],
  };
}

export function buildCanadaListingPaygEntitlementConsumePayload(input: {
  entitlement: CanadaListingPaygEntitlementRow | null;
  listingId: string;
  ownerId: string;
  consumedAt?: string;
  now?: Date;
}): CanadaListingPaygEntitlementConsumePayload {
  const validation = validateCanadaListingPaygEntitlementConsume(input);
  if (!validation.ok) {
    throw new Error(`Invalid Canada PAYG entitlement consume contract: ${validation.reason}`);
  }

  const entitlement = input.entitlement;
  if (!entitlement) {
    throw new Error("Invalid Canada PAYG entitlement consume contract: NO_ACTIVE_ENTITLEMENT");
  }

  const consumedAt = input.consumedAt ?? new Date().toISOString();
  return {
    entitlementId: entitlement.id,
    listingId: input.listingId,
    ownerId: input.ownerId,
    statusAfter: "consumed",
    activeAfter: false,
    consumedAt,
    metadataPatch: {
      consumed_by_live_runtime: false,
      consume_scope: "listing_only",
      consume_target: "listing_submission_unlock",
    },
    scope: "listing_only",
    accountWideCapBypass: false,
  };
}

export async function consumeCanadaListingPaygEntitlementDisabled(input: {
  entitlement: CanadaListingPaygEntitlementRow | null;
  listingId: string;
  ownerId: string;
  consumedAt?: string;
  now?: Date;
  client?: SupabaseClient | UntypedAdminClient | null;
}): Promise<CanadaListingPaygEntitlementConsumeDisabledResult> {
  const validation = validateCanadaListingPaygEntitlementConsume(input);
  if (!validation.ok) {
    throw new Error(`Invalid Canada PAYG entitlement consume contract: ${validation.reason}`);
  }

  const payload = buildCanadaListingPaygEntitlementConsumePayload(input);
  void input.client;

  return {
    entitlementId: payload.entitlementId,
    listingId: payload.listingId,
    ownerId: payload.ownerId,
    statusAfter: payload.statusAfter,
    activeAfter: payload.activeAfter,
    consumedAt: payload.consumedAt,
    scope: payload.scope,
    accountWideCapBypass: payload.accountWideCapBypass,
    mutationEnabled: CANADA_PAYG_ENTITLEMENT_CONSUME_ENABLED,
    mutated: false,
    payload,
    validation,
  };
}
