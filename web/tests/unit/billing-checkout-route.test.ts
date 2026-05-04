import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "@supabase/supabase-js";
import {
  postBillingCheckoutResponse,
  type BillingCheckoutRouteDeps,
} from "@/app/api/billing/checkout/route";
import type { PreparedCanadaRentalPaygStripeCheckout } from "@/lib/billing/canada-payg-stripe-prep.server";

const makeRequest = (payload: Record<string, unknown>) =>
  new Request("http://localhost/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

type ListingStub = {
  id: string;
  owner_id: string;
  status?: string | null;
  is_featured?: boolean | null;
  featured_until?: string | null;
  is_demo?: boolean | null;
  country_code?: string | null;
  listing_intent?: string | null;
  rental_type?: string | null;
};

function buildAdminClient(listing: ListingStub) {
  let insertedPayment: Record<string, unknown> | null = null;
  const client = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === "properties" ? listing : null,
            error: null,
          }),
        }),
      }),
      insert: async (payload: Record<string, unknown>) => {
        insertedPayment = table === "listing_payments" || table === "feature_purchases" ? payload : null;
        return { error: null };
      },
    }),
  };

  return {
    client,
    getInsertedPayment: () => insertedPayment,
  };
}

function buildDeps(options: {
  listing: ListingStub;
  loadCanadaDecision?: BillingCheckoutRouteDeps["loadCanadaRentalPaygRuntimeDecision"];
  prepareCanadaRentalPaygStripeCheckout?: BillingCheckoutRouteDeps["prepareCanadaRentalPaygStripeCheckout"];
  fetchImplementation?: BillingCheckoutRouteDeps["fetchImplementation"];
}) {
  const { client, getInsertedPayment } = buildAdminClient(options.listing);
  let fetchCalls = 0;
  const fetchImplementation: BillingCheckoutRouteDeps["fetchImplementation"] =
    options.fetchImplementation ??
    (async () => {
      fetchCalls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          data: {
            authorization_url: "https://paystack.example/checkout",
            reference: "ps_ref_123",
          },
        }),
      } as Response;
    });

  const deps: BillingCheckoutRouteDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => client as never,
    createServiceRoleClient: () => client as never,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: options.listing.owner_id, email: "owner@example.com" } as User,
        supabase: client,
      }) as Awaited<ReturnType<BillingCheckoutRouteDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    getProviderModes: async () => ({ paystackMode: "test" }),
    getPaystackConfig: async () => ({
      keyPresent: true,
      fallbackFromLive: false,
      mode: "test",
      secretKey: "sk_test",
    }),
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    getFeaturedConfig: async () => ({
      paygAmount: 1500,
      currency: "NGN",
    }),
    getSiteUrl: async () => "https://example.com",
    logFailure: () => undefined,
    logPropertyEvent: async () => ({ ok: true, data: {} }),
    resolveEventSessionKey: () => null,
    loadCanadaRentalPaygRuntimeDecision:
      options.loadCanadaDecision ??
      (async () => ({
        gateEnabled: false,
        marketCountry: "CA",
        runtimeSource: "legacy",
        resolverAvailable: true,
        stripePrepLayerAvailable: true,
        checkoutEnabled: false,
        checkoutCreationEnabled: false,
        readiness: {
          status: "blocked",
          eligible: true,
          reasonCode: "POLICY_STATE_NOT_READY",
          blockers: ["POLICY_STATE_NOT_READY"],
          marketCountry: "CA",
          role: "landlord",
          tier: "free",
          normalizedIntent: "rent",
          isShortlet: false,
          policyState: "draft",
          activeListingCount: 3,
          includedActiveListingLimit: 3,
          overIncludedCap: true,
          policyRow: null,
          entitlementRow: null,
          priceRow: null,
          amountMinor: 400,
          currency: "CAD",
          provider: "stripe",
          runtimeActivationAllowed: false,
          checkoutEnabled: false,
          warnings: [],
        },
        nextActivationPrerequisites: [],
      })),
    prepareCanadaRentalPaygStripeCheckout:
      options.prepareCanadaRentalPaygStripeCheckout ??
      ((input) =>
        ({
          ready: true,
          blockedReason: null,
          amountMinor: input.amountMinor,
          currency: "CAD",
          provider: "stripe",
          mode: "payment",
          lineItems: [
            {
              quantity: 1,
              price_data: {
                currency: "cad",
                unit_amount: input.amountMinor ?? 0,
                product_data: {
                  name: "Canada rental listing submission",
                  description: "Prepared Canada PAYG checkout",
                },
              },
            },
          ],
          metadata: {
            purpose: "listing_submission",
            market: "CA",
            listing_id: input.listingId,
            owner_id: input.ownerId,
            payer_user_id: input.userId,
            role: input.role ?? "unknown",
            tier: input.tier ?? "unknown",
            product_code: "listing_submission",
            pricing_source: "market_one_off_price_book",
            provider: "stripe",
            currency: "CAD",
            amount_minor: String(input.amountMinor ?? ""),
            checkout_enabled: "false",
          },
          successUrl: "https://example.com/host/properties/123/edit?payment=canada_payg&canada_payg=success",
          cancelUrl: "https://example.com/host/properties/123/edit?payment=canada_payg&canada_payg=cancel",
          idempotencyKey: "idem-ca-payg-123",
          checkoutCreationEnabled: false,
        }) satisfies PreparedCanadaRentalPaygStripeCheckout),
    fetchImplementation,
  };

  return {
    deps,
    getInsertedPayment,
    getFetchCalls: () => fetchCalls,
  };
}

void test("Canada checkout cannot create a live checkout when the gate is off", async () => {
  const { deps, getInsertedPayment, getFetchCalls } = buildDeps({
    listing: {
      id: "11111111-1111-4111-8111-111111111111",
      owner_id: "owner-1",
      status: "draft",
      country_code: "CA",
      listing_intent: "rent",
      rental_type: "long_term",
    },
  });

  const response = await postBillingCheckoutResponse(
    makeRequest({ listingId: "11111111-1111-4111-8111-111111111111", purpose: "listing_submission" }),
    deps
  );

  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.code, "CANADA_PAYG_RUNTIME_DISABLED");
  assert.equal(body.checkoutEnabled, false);
  assert.equal(body.runtimeActivationAllowed, false);
  assert.equal(getFetchCalls(), 0);
  assert.equal(getInsertedPayment(), null);
});

void test("Canada checkout returns not-ready when the gate is on but readiness is still blocked", async () => {
  const { deps, getInsertedPayment, getFetchCalls } = buildDeps({
    listing: {
      id: "22222222-2222-4222-8222-222222222222",
      owner_id: "owner-1",
      status: "draft",
      country_code: "CA",
      listing_intent: "rent",
      rental_type: "long_term",
    },
    loadCanadaDecision: async () => ({
      gateEnabled: true,
      marketCountry: "CA",
      runtimeSource: "legacy",
      resolverAvailable: true,
      stripePrepLayerAvailable: true,
      checkoutEnabled: false,
      checkoutCreationEnabled: false,
      readiness: {
        status: "blocked",
        eligible: true,
        reasonCode: "PRICE_ROW_DISABLED",
        blockers: ["PRICE_ROW_DISABLED"],
        marketCountry: "CA",
        role: "landlord",
        tier: "free",
        normalizedIntent: "rent",
        isShortlet: false,
        policyState: "live",
        activeListingCount: 3,
        includedActiveListingLimit: 3,
        overIncludedCap: true,
        policyRow: null,
        entitlementRow: null,
        priceRow: null,
        amountMinor: 400,
        currency: "CAD",
        provider: "stripe",
        runtimeActivationAllowed: false,
        checkoutEnabled: false,
        warnings: [],
      },
      nextActivationPrerequisites: [],
    }),
  });

  const response = await postBillingCheckoutResponse(
    makeRequest({ listingId: "22222222-2222-4222-8222-222222222222", purpose: "listing_submission" }),
    deps
  );

  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.code, "CANADA_PAYG_NOT_READY");
  assert.equal(body.checkoutEnabled, false);
  assert.equal(body.runtimeActivationAllowed, false);
  assert.equal(body.reasonCode, "PRICE_ROW_DISABLED");
  assert.equal(getFetchCalls(), 0);
  assert.equal(getInsertedPayment(), null);
});

void test("Canada checkout returns prepared Stripe diagnostics when gate is on and runtime readiness is activation-ready", async () => {
  const { deps, getInsertedPayment, getFetchCalls } = buildDeps({
    listing: {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      owner_id: "owner-1",
      status: "draft",
      country_code: "CA",
      listing_intent: "rent",
      rental_type: "long_term",
    },
    loadCanadaDecision: async () => ({
      gateEnabled: true,
      marketCountry: "CA",
      runtimeSource: "legacy",
      resolverAvailable: true,
      stripePrepLayerAvailable: true,
      checkoutEnabled: false,
      checkoutCreationEnabled: false,
      readiness: {
        status: "ready",
        eligible: true,
        reasonCode: "READY_FOR_RUNTIME_INTEGRATION",
        blockers: [],
        marketCountry: "CA",
        role: "agent",
        tier: "pro",
        normalizedIntent: "rent",
        isShortlet: false,
        policyState: "live",
        activeListingCount: 10,
        includedActiveListingLimit: 10,
        overIncludedCap: true,
        policyRow: null,
        entitlementRow: null,
        priceRow: null,
        amountMinor: 200,
        currency: "CAD",
        provider: "stripe",
        runtimeActivationAllowed: true,
        checkoutEnabled: false,
        warnings: [],
      },
      nextActivationPrerequisites: [],
    }),
  });

  const response = await postBillingCheckoutResponse(
    makeRequest({ listingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", purpose: "listing_submission" }),
    deps
  );

  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.code, "CANADA_PAYG_STRIPE_PREPARED_CHECKOUT_DISABLED");
  assert.equal(body.checkoutEnabled, false);
  assert.equal(body.runtimeActivationAllowed, true);
  assert.equal(body.amountMinor, 200);
  assert.equal(body.currency, "CAD");
  assert.equal(body.provider, "stripe");
  assert.equal(body.stripePrep.mode, "payment");
  assert.equal(body.stripePrep.metadata.purpose, "listing_submission");
  assert.equal(body.stripePrep.metadata.provider, "stripe");
  assert.equal(body.stripePrep.metadata.currency, "CAD");
  assert.equal(body.stripePrep.checkoutCreationEnabled, false);
  assert.equal(getFetchCalls(), 0);
  assert.equal(getInsertedPayment(), null);
});

void test("legacy NG listing checkout still follows the existing Paystack path", async () => {
  const { deps, getInsertedPayment, getFetchCalls } = buildDeps({
    listing: {
      id: "33333333-3333-4333-8333-333333333333",
      owner_id: "owner-1",
      status: "draft",
      country_code: "NG",
      listing_intent: "rent",
      rental_type: "long_term",
    },
  });

  const response = await postBillingCheckoutResponse(
    makeRequest({ listingId: "33333333-3333-4333-8333-333333333333", purpose: "listing_submission" }),
    deps
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.checkoutUrl, "https://paystack.example/checkout");
  assert.equal(body.currency, "NGN");
  assert.equal(getFetchCalls(), 1);
  assert.ok(getInsertedPayment());
});
