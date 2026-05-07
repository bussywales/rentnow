import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCanadaListingPaygEntitlementConsumePayload,
  buildCanadaListingPaygEntitlementInsertPayload,
  consumeCanadaListingPaygEntitlementDisabled,
  findActiveCanadaListingPaygEntitlement,
  grantCanadaListingPaygEntitlementDisabled,
  listingHasActiveCanadaPaygExtraSlot,
  resolveCanadaListingCapBypassDecision,
  resolveCanadaListingPaygUnlockDecision,
  resolveCanadaListingPaygUnlockDecisionFromRow,
  validateCanadaListingPaygEntitlementConsume,
  validateCanadaListingPaygEntitlementContract,
  type CanadaListingPaygEntitlementRow,
} from "@/lib/billing/canada-payg-entitlements.server";
import type { ActiveListingLimitGateResult } from "@/lib/plan-enforcement";
import {
  buildCanadaRentalPaygEntitlementGrantContract,
  validateCanadaRentalPaygWebhookContract,
} from "@/lib/billing/canada-payg-webhook-contract.server";
import type Stripe from "stripe";
import type { CanadaRentalPaygFulfilmentListingContext } from "@/lib/billing/canada-payg-fulfilment.server";

function buildListing(
  overrides: Partial<CanadaRentalPaygFulfilmentListingContext> = {}
): CanadaRentalPaygFulfilmentListingContext {
  return {
    id: "listing-ca-entitlement-1",
    ownerId: "owner-ca-1",
    countryCode: "CA",
    listingIntent: "rent",
    rentalType: "long_term",
    ...overrides,
  };
}

function buildEvent(
  metadataOverrides: Record<string, string | null | undefined> = {},
  eventType = "checkout.session.completed"
): Pick<Stripe.Event, "type" | "id" | "data"> {
  return {
    id: "evt_ca_entitlement_1",
    type: eventType,
    data: {
      object: {
        id: "cs_ca_entitlement_1",
        object: "checkout.session",
        metadata: {
          purpose: "listing_submission",
          market: "CA",
          listing_id: "listing-ca-entitlement-1",
          owner_id: "owner-ca-1",
          payer_user_id: "user-ca-1",
          role: "landlord",
          tier: "free",
          product_code: "listing_submission",
          pricing_source: "market_one_off_price_book",
          provider: "stripe",
          currency: "CAD",
          amount_minor: "400",
          checkout_enabled: "false",
          ...metadataOverrides,
        },
      },
    },
  } as unknown as Pick<Stripe.Event, "type" | "id" | "data">;
}

function buildGrantContract(overrides: {
  metadataOverrides?: Record<string, string | null | undefined>;
  listingOverrides?: Partial<CanadaRentalPaygFulfilmentListingContext>;
  paymentIntentId?: string | null;
} = {}) {
  const validation = validateCanadaRentalPaygWebhookContract({
    event: buildEvent(overrides.metadataOverrides),
    listing: buildListing(overrides.listingOverrides),
    expectedPricing: { amountMinor: 400, currency: "CAD", provider: "stripe" },
  });

  assert.equal(validation.ok, true);
  if (!validation.ok) throw new Error(`expected valid contract, got ${validation.reasonCode}`);

  return buildCanadaRentalPaygEntitlementGrantContract(validation, {
    event: buildEvent(overrides.metadataOverrides),
    checkoutSessionId: "cs_ca_entitlement_1",
    paymentIntentId: overrides.paymentIntentId ?? "pi_ca_entitlement_1",
  });
}

void test("Canada entitlement helper builds a disabled insert payload from a valid webhook contract", async () => {
  const contract = buildGrantContract();
  const validation = validateCanadaListingPaygEntitlementContract(contract);
  assert.equal(validation.ok, true);

  const payload = buildCanadaListingPaygEntitlementInsertPayload(contract, "2026-05-07T11:00:00.000Z");
  assert.deepEqual(payload, {
    listing_id: "listing-ca-entitlement-1",
    owner_id: "owner-ca-1",
    market_country: "CA",
    provider: "stripe",
    purpose: "listing_submission",
    role: "landlord",
    tier: "free",
    amount_minor: 400,
    currency: "CAD",
    stripe_checkout_session_id: "cs_ca_entitlement_1",
    stripe_payment_intent_id: "pi_ca_entitlement_1",
    stripe_event_id: "evt_ca_entitlement_1",
    idempotency_key: "canada_payg_entitlement:evt_ca_entitlement_1",
    status: "granted",
    active: true,
    granted_at: "2026-05-07T11:00:00.000Z",
    consumed_at: null,
    revoked_at: null,
    expires_at: null,
    metadata: {
      entitlement_scope: "listing_scoped_extra_slot",
      unlock_target: "listing_submission_recovery",
      source: "stripe_checkout_session_completed",
      inserted_by_live_runtime: false,
    },
  });

  const disabled = await grantCanadaListingPaygEntitlementDisabled({
    contract,
    grantedAt: "2026-05-07T11:00:00.000Z",
  });
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.wouldInsert, true);
  assert.equal(disabled.inserted, false);
  assert.equal(disabled.payload.idempotency_key, "canada_payg_entitlement:evt_ca_entitlement_1");
});

void test("Canada entitlement helper rejects wrong market/provider/currency/purpose", () => {
  const baseContract = buildGrantContract();

  const wrongMarket = validateCanadaListingPaygEntitlementContract({
    ...baseContract,
    fields: { ...baseContract.fields, marketCountry: "NG" as "CA" },
  });
  assert.equal(wrongMarket.ok, false);
  if (!wrongMarket.ok) assert.equal(wrongMarket.reason, "WRONG_MARKET");

  const wrongProvider = validateCanadaListingPaygEntitlementContract(
    { ...baseContract, fields: { ...baseContract.fields, provider: "paystack" as const } }
  );
  assert.equal(wrongProvider.ok, false);
  if (!wrongProvider.ok) assert.equal(wrongProvider.reason, "WRONG_PROVIDER");

  const wrongCurrency = validateCanadaListingPaygEntitlementContract(
    { ...baseContract, fields: { ...baseContract.fields, currency: "NGN" as const } }
  );
  assert.equal(wrongCurrency.ok, false);
  if (!wrongCurrency.ok) assert.equal(wrongCurrency.reason, "WRONG_CURRENCY");

  const wrongPurpose = validateCanadaListingPaygEntitlementContract(
    { ...baseContract, fields: { ...baseContract.fields, purpose: "featured_listing" as const } }
  );
  assert.equal(wrongPurpose.ok, false);
  if (!wrongPurpose.ok) assert.equal(wrongPurpose.reason, "WRONG_PURPOSE");
});

void test("Canada entitlement helper rejects tenant and enterprise while preserving idempotency rules", () => {
  const baseContract = buildGrantContract();
  const tenant = validateCanadaListingPaygEntitlementContract(
    { ...baseContract, fields: { ...baseContract.fields, role: "tenant", tier: "free" } }
  );
  assert.equal(tenant.ok, false);
  if (!tenant.ok) assert.equal(tenant.reason, "INVALID_ROLE");

  const enterprise = validateCanadaListingPaygEntitlementContract(
    { ...baseContract, fields: { ...baseContract.fields, role: "agent", tier: "enterprise" } }
  );
  assert.equal(enterprise.ok, false);
  if (!enterprise.ok) assert.equal(enterprise.reason, "INVALID_TIER");

  const missingIdempotency = validateCanadaListingPaygEntitlementContract(
    { ...baseContract, fields: { ...baseContract.fields, idempotencyKey: "" } }
  );
  assert.equal(missingIdempotency.ok, false);
  if (!missingIdempotency.ok) assert.equal(missingIdempotency.reason, "MISSING_IDEMPOTENCY_KEY");
});

void test("Canada entitlement lookup helper only treats active granted rows as valid extra slots", async () => {
  const activeRow: CanadaListingPaygEntitlementRow = {
    id: "ent-1",
    listing_id: "listing-ca-entitlement-1",
    owner_id: "owner-ca-1",
    market_country: "CA",
    provider: "stripe",
    purpose: "listing_submission",
    role: "landlord",
    tier: "free",
    amount_minor: 400,
    currency: "CAD",
    stripe_checkout_session_id: "cs_ca_entitlement_1",
    stripe_payment_intent_id: "pi_ca_entitlement_1",
    stripe_event_id: "evt_ca_entitlement_1",
    idempotency_key: "canada_payg_entitlement:evt_ca_entitlement_1",
    status: "granted",
    active: true,
    granted_at: "2026-05-07T11:00:00.000Z",
    consumed_at: null,
    revoked_at: null,
    expires_at: null,
    metadata: {},
    created_at: "2026-05-07T11:00:00.000Z",
    updated_at: "2026-05-07T11:00:00.000Z",
  };

  const consumedRow = { ...activeRow, id: "ent-2", status: "consumed" as const, active: false, consumed_at: "2026-05-08T00:00:00.000Z" };

  const chain = {
    eq() {
      return chain;
    },
    async order() {
      return { data: [consumedRow, activeRow] };
    },
  };

  const client = {
    from: () => ({
      select: () => chain,
    }),
  } as never;

  const row = await findActiveCanadaListingPaygEntitlement({
    client,
    listingId: "listing-ca-entitlement-1",
    ownerId: "owner-ca-1",
    now: new Date("2026-05-09T00:00:00.000Z"),
  });
  assert.equal(row?.id, "ent-1");

  const summary = await listingHasActiveCanadaPaygExtraSlot({
    client,
    listingId: "listing-ca-entitlement-1",
    ownerId: "owner-ca-1",
    now: new Date("2026-05-09T00:00:00.000Z"),
  });
  assert.equal(summary.hasActiveEntitlement, true);
  assert.equal(summary.entitlement?.id, "ent-1");
});

void test("Canada entitlement unlock decision returns listing-only unlock for a valid active entitlement", async () => {
  const activeRow: CanadaListingPaygEntitlementRow = {
    id: "ent-unlock-1",
    listing_id: "listing-ca-entitlement-1",
    owner_id: "owner-ca-1",
    market_country: "CA",
    provider: "stripe",
    purpose: "listing_submission",
    role: "landlord",
    tier: "free",
    amount_minor: 400,
    currency: "CAD",
    stripe_checkout_session_id: "cs_ca_entitlement_1",
    stripe_payment_intent_id: "pi_ca_entitlement_1",
    stripe_event_id: "evt_ca_entitlement_1",
    idempotency_key: "canada_payg_entitlement:evt_ca_entitlement_1",
    status: "granted",
    active: true,
    granted_at: "2026-05-07T11:00:00.000Z",
    consumed_at: null,
    revoked_at: null,
    expires_at: null,
    metadata: {},
    created_at: "2026-05-07T11:00:00.000Z",
    updated_at: "2026-05-07T11:00:00.000Z",
  };

  const decision = resolveCanadaListingPaygUnlockDecisionFromRow({
    entitlement: activeRow,
    listingId: "listing-ca-entitlement-1",
    ownerId: "owner-ca-1",
    now: new Date("2026-05-09T00:00:00.000Z"),
  });

  assert.deepEqual(decision, {
    wouldUnlock: true,
    reasonCode: "ACTIVE_ENTITLEMENT_FOUND",
    listingId: "listing-ca-entitlement-1",
    ownerId: "owner-ca-1",
    entitlementId: "ent-unlock-1",
    scope: "listing_only",
    accountWideCapBypass: false,
    runtimeMutationEnabled: false,
  });
});

void test("Canada entitlement unlock decision rejects wrong listing, wrong owner, and inactive states", () => {
  const baseRow: CanadaListingPaygEntitlementRow = {
    id: "ent-unlock-2",
    listing_id: "listing-ca-entitlement-1",
    owner_id: "owner-ca-1",
    market_country: "CA",
    provider: "stripe",
    purpose: "listing_submission",
    role: "agent",
    tier: "pro",
    amount_minor: 200,
    currency: "CAD",
    stripe_checkout_session_id: "cs_ca_entitlement_2",
    stripe_payment_intent_id: "pi_ca_entitlement_2",
    stripe_event_id: "evt_ca_entitlement_2",
    idempotency_key: "canada_payg_entitlement:evt_ca_entitlement_2",
    status: "granted",
    active: true,
    granted_at: "2026-05-07T11:00:00.000Z",
    consumed_at: null,
    revoked_at: null,
    expires_at: null,
    metadata: {},
    created_at: "2026-05-07T11:00:00.000Z",
    updated_at: "2026-05-07T11:00:00.000Z",
  };

  assert.equal(
    resolveCanadaListingPaygUnlockDecisionFromRow({
      entitlement: { ...baseRow, listing_id: "listing-other" },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
    }).reasonCode,
    "WRONG_LISTING"
  );

  assert.equal(
    resolveCanadaListingPaygUnlockDecisionFromRow({
      entitlement: { ...baseRow, owner_id: "owner-other" },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
    }).reasonCode,
    "WRONG_OWNER"
  );

  assert.equal(
    resolveCanadaListingPaygUnlockDecisionFromRow({
      entitlement: { ...baseRow, active: false },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
    }).reasonCode,
    "INACTIVE"
  );

  assert.equal(
    resolveCanadaListingPaygUnlockDecisionFromRow({
      entitlement: { ...baseRow, consumed_at: "2026-05-08T00:00:00.000Z" },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
    }).reasonCode,
    "CONSUMED"
  );

  assert.equal(
    resolveCanadaListingPaygUnlockDecisionFromRow({
      entitlement: { ...baseRow, revoked_at: "2026-05-08T00:00:00.000Z" },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
    }).reasonCode,
    "REVOKED"
  );

  assert.equal(
    resolveCanadaListingPaygUnlockDecisionFromRow({
      entitlement: { ...baseRow, expires_at: "2026-05-08T00:00:00.000Z" },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
      now: new Date("2026-05-09T00:00:00.000Z"),
    }).reasonCode,
    "EXPIRED"
  );
});

void test("Canada entitlement unlock decision rejects wrong market/provider/currency/purpose and unsupported role or tier", () => {
  const baseRow: CanadaListingPaygEntitlementRow = {
    id: "ent-unlock-3",
    listing_id: "listing-ca-entitlement-1",
    owner_id: "owner-ca-1",
    market_country: "CA",
    provider: "stripe",
    purpose: "listing_submission",
    role: "landlord",
    tier: "free",
    amount_minor: 400,
    currency: "CAD",
    stripe_checkout_session_id: "cs_ca_entitlement_3",
    stripe_payment_intent_id: "pi_ca_entitlement_3",
    stripe_event_id: "evt_ca_entitlement_3",
    idempotency_key: "canada_payg_entitlement:evt_ca_entitlement_3",
    status: "granted",
    active: true,
    granted_at: "2026-05-07T11:00:00.000Z",
    consumed_at: null,
    revoked_at: null,
    expires_at: null,
    metadata: {},
    created_at: "2026-05-07T11:00:00.000Z",
    updated_at: "2026-05-07T11:00:00.000Z",
  };

  assert.equal(
    resolveCanadaListingPaygUnlockDecisionFromRow({
      entitlement: { ...baseRow, market_country: "NG" as "CA" },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
    }).reasonCode,
    "WRONG_MARKET"
  );
  assert.equal(
    resolveCanadaListingPaygUnlockDecisionFromRow({
      entitlement: { ...baseRow, provider: "paystack" as "stripe" },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
    }).reasonCode,
    "WRONG_PROVIDER"
  );
  assert.equal(
    resolveCanadaListingPaygUnlockDecisionFromRow({
      entitlement: { ...baseRow, currency: "NGN" as "CAD" },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
    }).reasonCode,
    "WRONG_CURRENCY"
  );
  assert.equal(
    resolveCanadaListingPaygUnlockDecisionFromRow({
      entitlement: { ...baseRow, purpose: "featured_listing" as "listing_submission" },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
    }).reasonCode,
    "WRONG_PURPOSE"
  );
  assert.equal(
    resolveCanadaListingPaygUnlockDecisionFromRow({
      entitlement: { ...baseRow, role: "tenant" as never },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
    }).reasonCode,
    "TENANT_REJECTED"
  );
  assert.equal(
    resolveCanadaListingPaygUnlockDecisionFromRow({
      entitlement: { ...baseRow, tier: "enterprise" as never },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
    }).reasonCode,
    "ENTERPRISE_REJECTED"
  );
});

void test("Canada entitlement unlock decision lookup returns no active entitlement when the listing has none", async () => {
  const chain = {
    eq() {
      return chain;
    },
    async order() {
      return { data: [] };
    },
  };

  const client = {
    from: () => ({
      select: () => chain,
    }),
  } as never;

  const decision = await resolveCanadaListingPaygUnlockDecision({
    client,
    listingId: "listing-ca-entitlement-1",
    ownerId: "owner-ca-1",
    now: new Date("2026-05-09T00:00:00.000Z"),
  });

  assert.equal(decision.wouldUnlock, false);
  assert.equal(decision.reasonCode, "NO_ACTIVE_ENTITLEMENT");
  assert.equal(decision.accountWideCapBypass, false);
  assert.equal(decision.scope, "listing_only");
});

void test("Canada cap-bypass decision keeps unpaid or gated over-cap listings blocked", () => {
  const activeLimit: ActiveListingLimitGateResult = {
    ok: false,
    error: "Plan limit reached",
    code: "plan_limit_reached",
    maxListings: 3,
    activeCount: 3,
    planTier: "free",
    usage: {
      plan: { tier: "free", maxListings: 3, name: "Free" },
      activeCount: 3,
      source: "service",
    },
  };

  const noEntitlement = resolveCanadaListingCapBypassDecision({
    marketCountry: "CA",
    listingIntent: "rent",
    rentalType: "long_term",
    activeLimit,
    runtimeGateEnabled: true,
    unlockGateEnabled: true,
    entitlementDecision: {
      wouldUnlock: false,
      reasonCode: "NO_ACTIVE_ENTITLEMENT",
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
      entitlementId: null,
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    },
  });
  assert.equal(noEntitlement.capBypassAllowed, false);
  assert.equal(noEntitlement.reasonCode, "NO_ACTIVE_ENTITLEMENT");
  assert.equal(noEntitlement.accountWideCapBypass, false);

  const unlockDisabled = resolveCanadaListingCapBypassDecision({
    marketCountry: "CA",
    listingIntent: "rent",
    rentalType: "long_term",
    activeLimit,
    runtimeGateEnabled: true,
    unlockGateEnabled: false,
    entitlementDecision: {
      wouldUnlock: true,
      reasonCode: "ACTIVE_ENTITLEMENT_FOUND",
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
      entitlementId: "ent-1",
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    },
  });
  assert.equal(unlockDisabled.capBypassAllowed, false);
  assert.equal(unlockDisabled.reasonCode, "CANADA_PAYG_UNLOCK_DISABLED");
  assert.equal(unlockDisabled.accountWideCapBypass, false);
});

void test("Canada cap-bypass decision returns a listing-only ready decision for a valid active entitlement", () => {
  const activeLimit: ActiveListingLimitGateResult = {
    ok: false,
    error: "Plan limit reached",
    code: "plan_limit_reached",
    maxListings: 3,
    activeCount: 3,
    planTier: "free",
    usage: {
      plan: { tier: "free", maxListings: 3, name: "Free" },
      activeCount: 3,
      source: "service",
    },
  };

  const ready = resolveCanadaListingCapBypassDecision({
    marketCountry: "CA",
    listingIntent: "rent",
    rentalType: "long_term",
    activeLimit,
    runtimeGateEnabled: true,
    unlockGateEnabled: true,
    entitlementDecision: {
      wouldUnlock: true,
      reasonCode: "ACTIVE_ENTITLEMENT_FOUND",
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
      entitlementId: "ent-1",
      scope: "listing_only",
      accountWideCapBypass: false,
      runtimeMutationEnabled: false,
    },
  });

  assert.deepEqual(ready, {
    capBypassAllowed: true,
    reasonCode: "CANADA_PAYG_CAP_BYPASS_READY",
    listingId: "listing-ca-entitlement-1",
    ownerId: "owner-ca-1",
    entitlementId: "ent-1",
    scope: "listing_only",
    accountWideCapBypass: false,
    consumeEntitlementEnabled: false,
  });
});

void test("Canada cap-bypass decision rejects non-rental and shortlet listing contexts", () => {
  const activeLimit: ActiveListingLimitGateResult = {
    ok: false,
    error: "Plan limit reached",
    code: "plan_limit_reached",
    maxListings: 3,
    activeCount: 3,
    planTier: "free",
    usage: {
      plan: { tier: "free", maxListings: 3, name: "Free" },
      activeCount: 3,
      source: "service",
    },
  };
  const entitlementDecision = {
    wouldUnlock: true,
    reasonCode: "ACTIVE_ENTITLEMENT_FOUND" as const,
    listingId: "listing-ca-entitlement-1",
    ownerId: "owner-ca-1",
    entitlementId: "ent-1",
    scope: "listing_only" as const,
    accountWideCapBypass: false as const,
    runtimeMutationEnabled: false as const,
  };

  const sale = resolveCanadaListingCapBypassDecision({
    marketCountry: "CA",
    listingIntent: "sale",
    rentalType: null,
    activeLimit,
    runtimeGateEnabled: true,
    unlockGateEnabled: true,
    entitlementDecision,
  });
  assert.equal(sale.capBypassAllowed, false);
  assert.equal(sale.reasonCode, "NON_RENTAL_LISTING");

  const shortlet = resolveCanadaListingCapBypassDecision({
    marketCountry: "CA",
    listingIntent: "rent",
    rentalType: "short_let",
    activeLimit,
    runtimeGateEnabled: true,
    unlockGateEnabled: true,
    entitlementDecision,
  });
  assert.equal(shortlet.capBypassAllowed, false);
  assert.equal(shortlet.reasonCode, "SHORTLET_EXCLUDED");
});

void test("Canada entitlement consume helper builds a listing-only disabled consume payload for a valid active entitlement", async () => {
  const activeRow: CanadaListingPaygEntitlementRow = {
    id: "ent-consume-1",
    listing_id: "listing-ca-entitlement-1",
    owner_id: "owner-ca-1",
    market_country: "CA",
    provider: "stripe",
    purpose: "listing_submission",
    role: "landlord",
    tier: "free",
    amount_minor: 400,
    currency: "CAD",
    stripe_checkout_session_id: "cs_ca_entitlement_1",
    stripe_payment_intent_id: "pi_ca_entitlement_1",
    stripe_event_id: "evt_ca_entitlement_1",
    idempotency_key: "canada_payg_entitlement:evt_ca_entitlement_1",
    status: "granted",
    active: true,
    granted_at: "2026-05-07T11:00:00.000Z",
    consumed_at: null,
    revoked_at: null,
    expires_at: null,
    metadata: {},
    created_at: "2026-05-07T11:00:00.000Z",
    updated_at: "2026-05-07T11:00:00.000Z",
  };

  const validation = validateCanadaListingPaygEntitlementConsume({
    entitlement: activeRow,
    listingId: "listing-ca-entitlement-1",
    ownerId: "owner-ca-1",
    now: new Date("2026-05-09T00:00:00.000Z"),
  });
  assert.equal(validation.ok, true);

  const payload = buildCanadaListingPaygEntitlementConsumePayload({
    entitlement: activeRow,
    listingId: "listing-ca-entitlement-1",
    ownerId: "owner-ca-1",
    consumedAt: "2026-05-09T12:00:00.000Z",
    now: new Date("2026-05-09T00:00:00.000Z"),
  });
  assert.deepEqual(payload, {
    entitlementId: "ent-consume-1",
    listingId: "listing-ca-entitlement-1",
    ownerId: "owner-ca-1",
    statusAfter: "consumed",
    activeAfter: false,
    consumedAt: "2026-05-09T12:00:00.000Z",
    metadataPatch: {
      consumed_by_live_runtime: false,
      consume_scope: "listing_only",
      consume_target: "listing_submission_unlock",
    },
    scope: "listing_only",
    accountWideCapBypass: false,
  });

  let updateCalled = false;
  const disabled = await consumeCanadaListingPaygEntitlementDisabled({
    entitlement: activeRow,
    listingId: "listing-ca-entitlement-1",
    ownerId: "owner-ca-1",
    consumedAt: "2026-05-09T12:00:00.000Z",
    client: {
      from: () => ({
        update: () => {
          updateCalled = true;
          throw new Error("should not update");
        },
      }),
    } as never,
  });
  assert.equal(disabled.mutationEnabled, false);
  assert.equal(disabled.mutated, false);
  assert.equal(disabled.statusAfter, "consumed");
  assert.equal(disabled.activeAfter, false);
  assert.equal(disabled.scope, "listing_only");
  assert.equal(disabled.accountWideCapBypass, false);
  assert.equal(updateCalled, false);
});

void test("Canada entitlement consume helper rejects wrong listing, wrong owner, and invalid entitlement states", () => {
  const baseRow: CanadaListingPaygEntitlementRow = {
    id: "ent-consume-2",
    listing_id: "listing-ca-entitlement-1",
    owner_id: "owner-ca-1",
    market_country: "CA",
    provider: "stripe",
    purpose: "listing_submission",
    role: "agent",
    tier: "pro",
    amount_minor: 200,
    currency: "CAD",
    stripe_checkout_session_id: "cs_ca_entitlement_2",
    stripe_payment_intent_id: "pi_ca_entitlement_2",
    stripe_event_id: "evt_ca_entitlement_2",
    idempotency_key: "canada_payg_entitlement:evt_ca_entitlement_2",
    status: "granted",
    active: true,
    granted_at: "2026-05-07T11:00:00.000Z",
    consumed_at: null,
    revoked_at: null,
    expires_at: null,
    metadata: {},
    created_at: "2026-05-07T11:00:00.000Z",
    updated_at: "2026-05-07T11:00:00.000Z",
  };

  assert.equal(
    validateCanadaListingPaygEntitlementConsume({
      entitlement: { ...baseRow, listing_id: "listing-other" },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
    }).ok,
    false
  );
  assert.equal(
    validateCanadaListingPaygEntitlementConsume({
      entitlement: { ...baseRow, owner_id: "owner-other" },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
    }).ok,
    false
  );
  assert.equal(
    validateCanadaListingPaygEntitlementConsume({
      entitlement: { ...baseRow, active: false },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
    }).ok,
    false
  );
  assert.equal(
    validateCanadaListingPaygEntitlementConsume({
      entitlement: { ...baseRow, consumed_at: "2026-05-08T00:00:00.000Z" },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
    }).ok,
    false
  );
  assert.equal(
    validateCanadaListingPaygEntitlementConsume({
      entitlement: { ...baseRow, revoked_at: "2026-05-08T00:00:00.000Z" },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
    }).ok,
    false
  );
  assert.equal(
    validateCanadaListingPaygEntitlementConsume({
      entitlement: { ...baseRow, expires_at: "2026-05-08T00:00:00.000Z" },
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
      now: new Date("2026-05-09T00:00:00.000Z"),
    }).ok,
    false
  );
});

void test("Canada entitlement consume helper rejects tenant, enterprise, and wrong market/provider/currency/purpose", () => {
  const baseRow: CanadaListingPaygEntitlementRow = {
    id: "ent-consume-3",
    listing_id: "listing-ca-entitlement-1",
    owner_id: "owner-ca-1",
    market_country: "CA",
    provider: "stripe",
    purpose: "listing_submission",
    role: "landlord",
    tier: "free",
    amount_minor: 400,
    currency: "CAD",
    stripe_checkout_session_id: "cs_ca_entitlement_3",
    stripe_payment_intent_id: "pi_ca_entitlement_3",
    stripe_event_id: "evt_ca_entitlement_3",
    idempotency_key: "canada_payg_entitlement:evt_ca_entitlement_3",
    status: "granted",
    active: true,
    granted_at: "2026-05-07T11:00:00.000Z",
    consumed_at: null,
    revoked_at: null,
    expires_at: null,
    metadata: {},
    created_at: "2026-05-07T11:00:00.000Z",
    updated_at: "2026-05-07T11:00:00.000Z",
  };

  const invalidCases: CanadaListingPaygEntitlementRow[] = [
    { ...baseRow, market_country: "NG" as "CA" },
    { ...baseRow, provider: "paystack" as "stripe" },
    { ...baseRow, currency: "NGN" as "CAD" },
    { ...baseRow, purpose: "featured_listing" as "listing_submission" },
    { ...baseRow, role: "tenant" as never, tier: "free" },
    { ...baseRow, role: "agent", tier: "enterprise" as never },
    { ...baseRow, status: "revoked" },
  ];

  for (const entitlement of invalidCases) {
    const validation = validateCanadaListingPaygEntitlementConsume({
      entitlement,
      listingId: "listing-ca-entitlement-1",
      ownerId: "owner-ca-1",
    });
    assert.equal(validation.ok, false);
  }
});
