import test from "node:test";
import assert from "node:assert/strict";
import type { User } from "@supabase/supabase-js";
import {
  postBillingCheckoutResponse,
  type BillingCheckoutRouteDeps,
} from "@/app/api/billing/checkout/route";

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
        checkoutEnabled: false,
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

void test("Canada checkout stays disabled even when the guarded runtime decision is activation-ready", async () => {
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
      checkoutEnabled: false,
      readiness: {
        status: "ready",
        eligible: true,
        reasonCode: "READY_FOR_RUNTIME_INTEGRATION",
        blockers: [],
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
        runtimeActivationAllowed: true,
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
  assert.equal(body.code, "CANADA_PAYG_CHECKOUT_DISABLED");
  assert.equal(body.checkoutEnabled, false);
  assert.equal(body.runtimeActivationAllowed, true);
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
