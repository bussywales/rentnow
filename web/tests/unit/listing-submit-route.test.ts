import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { postPropertySubmitResponse, type ListingSubmitDeps } from "@/app/api/properties/[id]/submit/route";

const makeRequest = (payload: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/properties/prop1/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

type ListingRow = {
  id: string;
  owner_id: string;
  status?: string | null;
  submitted_at?: string | null;
  country_code?: string | null;
  listing_intent?: string | null;
  rental_type?: string | null;
};

const buildSupabaseStub = (
  listing: ListingRow,
  options?: {
    nightlyPriceMinor?: number | null;
    activeCount?: number;
    planTier?: string;
    maxListingsOverride?: number | null;
    validUntil?: string | null;
  }
) => {
  let lastPropertyUpdate: Record<string, unknown> | null = null;
  const buildCountQuery = () => {
    const result = { count: options?.activeCount ?? 0, error: null };
    const builder = {
      eq() {
        return builder;
      },
      neq() {
        return builder;
      },
      then(resolve: (value: typeof result) => unknown) {
        return Promise.resolve(resolve(result));
      },
    };
    return builder;
  };
  const supabase = {
    from: (table: string) => ({
      select: (...args: unknown[]) => {
        const selectOptions = args[1] as { count?: string; head?: boolean } | undefined;
        if (table === "properties" && selectOptions?.count === "exact" && selectOptions?.head) {
          return buildCountQuery();
        }
        return {
          eq: () => ({
            maybeSingle: async () => {
              if (table === "shortlet_settings") {
                return { data: { nightly_price_minor: options?.nightlyPriceMinor ?? null } };
              }
              if (table === "profile_plans") {
                return {
                  data: {
                    plan_tier: options?.planTier ?? "free",
                    max_listings_override: options?.maxListingsOverride ?? null,
                    valid_until: options?.validUntil ?? null,
                  },
                  error: null,
                };
              }
              return { data: listing };
            },
          }),
        };
      },
      update: (payload: Record<string, unknown>) => ({
        eq: async () => {
          if (table === "properties") {
            lastPropertyUpdate = payload;
          }
          return { error: null };
        },
      }),
    }),
    rpc: async () => ({ data: { inserted: true } }),
  };

  return {
    supabase,
    getLastPropertyUpdate: () => lastPropertyUpdate,
  };
};

void test("submit blocks when active listing limit is already reached", async () => {
  const listing: ListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "draft",
    submitted_at: null,
  };
  const { supabase, getLastPropertyUpdate } = buildSupabaseStub(listing, {
    activeCount: 5,
    planTier: "starter",
    maxListingsOverride: 5,
  });
  const typedSupabase = supabase as ReturnType<
    ListingSubmitDeps["createServerSupabaseClient"]
  >;
  let consumedAttempted = false;

  const deps: ListingSubmitDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => typedSupabase,
    createServiceRoleClient: () =>
      typedSupabase as ReturnType<ListingSubmitDeps["createServiceRoleClient"]>,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase: typedSupabase,
      }) as Awaited<ReturnType<ListingSubmitDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => {
      consumedAttempted = true;
      return { ok: true, consumed: true, alreadyConsumed: false, source: "payg", creditId: "credit-1", idempotencyKey: "idem-submit-limit" };
    },
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    getAppSettingBool: async () => false,
    getListingExpiryDays: async () => 90,
    requireLegalAcceptance: async () => ({ ok: true, status: {} }) as Awaited<
      ReturnType<ListingSubmitDeps["requireLegalAcceptance"]>
    >,
    logPropertyEvent: async () => ({ ok: true, data: {} }),
    resolveEventSessionKey: () => null,
    logFailure: () => undefined,
  };

  const res = await postPropertySubmitResponse(
    makeRequest({ idempotencyKey: "idem-submit-limit" }),
    "prop1",
    deps
  );
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.code, "plan_limit_reached");
  assert.equal(body.reason, "LISTING_LIMIT_REACHED");
  assert.equal(body.maxListings, 5);
  assert.equal(body.activeCount, 5);
  assert.equal(body.billingUrl, "/dashboard/billing#plans");
  assert.equal(body.manageUrl, "/host/listings?view=manage");
  assert.match(String(body.resumeUrl ?? ""), /^\/host\/properties\/prop-?1\/edit\?/);
  assert.match(String(body.resumeUrl ?? ""), /monetization=listing_limit/);
  assert.match(String(body.resumeUrl ?? ""), /monetization_context=submission/);
  assert.match(String(body.detail ?? ""), /Upgrade your plan or manage active listings/);
  assert.equal(consumedAttempted, false);
  assert.equal(getLastPropertyUpdate(), null);
});

void test("submit returns payment required when no credits", async () => {
  const listing: ListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "draft",
    submitted_at: null,
  };
  const { supabase } = buildSupabaseStub(listing);
  const typedSupabase = supabase as ReturnType<
    ListingSubmitDeps["createServerSupabaseClient"]
  >;

  const deps: ListingSubmitDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => typedSupabase,
    createServiceRoleClient: () =>
      typedSupabase as ReturnType<ListingSubmitDeps["createServiceRoleClient"]>,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase: typedSupabase,
      }) as Awaited<ReturnType<ListingSubmitDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => ({ ok: false, reason: "NO_CREDITS" }),
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    getAppSettingBool: async () => false,
    getListingExpiryDays: async () => 90,
    requireLegalAcceptance: async () => ({ ok: true, status: {} }) as Awaited<
      ReturnType<ListingSubmitDeps["requireLegalAcceptance"]>
    >,
    logPropertyEvent: async () => ({ ok: true, data: {} }),
    resolveEventSessionKey: () => null,
    logFailure: () => undefined,
  };

  const res = await postPropertySubmitResponse(
    makeRequest({ idempotencyKey: "idem-12345" }),
    "prop1",
    deps
  );
  assert.equal(res.status, 402);
  const json = await res.json();
  assert.equal(json.reason, "PAYMENT_REQUIRED");
  assert.equal(json.billingUrl, "/dashboard/billing#plans");
  assert.match(String(json.resumeUrl ?? ""), /^\/host\/properties\/prop1\/edit\?/);
  assert.match(String(json.resumeUrl ?? ""), /monetization=payment_required/);
});

void test("Canada submit keeps legacy payment-required behaviour while the guarded runtime gate is off", async () => {
  const listing: ListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "draft",
    submitted_at: null,
    country_code: "CA",
    listing_intent: "rent",
    rental_type: "long_term",
  };
  const { supabase } = buildSupabaseStub(listing, {
    activeCount: 3,
    planTier: "starter",
    maxListingsOverride: 5,
  });
  const typedSupabase = supabase as ReturnType<
    ListingSubmitDeps["createServerSupabaseClient"]
  >;
  let canadaRuntimeChecks = 0;

  const deps: ListingSubmitDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => typedSupabase,
    createServiceRoleClient: () =>
      typedSupabase as ReturnType<ListingSubmitDeps["createServiceRoleClient"]>,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase: typedSupabase,
      }) as Awaited<ReturnType<ListingSubmitDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => ({ ok: false, reason: "NO_CREDITS" }),
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    getAppSettingBool: async () => false,
    getListingExpiryDays: async () => 90,
    requireLegalAcceptance: async () => ({ ok: true, status: {} }) as Awaited<
      ReturnType<ListingSubmitDeps["requireLegalAcceptance"]>
    >,
    logPropertyEvent: async () => ({ ok: true, data: {} }),
    resolveEventSessionKey: () => null,
    logFailure: () => undefined,
    loadCanadaRentalPaygRuntimeDecision: async () => {
      canadaRuntimeChecks += 1;
      return {
        gateEnabled: false,
        marketCountry: "CA",
        runtimeSource: "legacy" as const,
        resolverAvailable: true as const,
        checkoutEnabled: false as const,
        readiness: {
          status: "blocked" as const,
          eligible: true,
          reasonCode: "POLICY_STATE_NOT_READY" as const,
          blockers: ["POLICY_STATE_NOT_READY" as const],
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
      };
    },
  };

  const res = await postPropertySubmitResponse(
    makeRequest({ idempotencyKey: "idem-ca-gate-off" }),
    "prop1",
    deps
  );
  assert.equal(res.status, 402);
  const json = await res.json();
  assert.equal(json.reason, "PAYMENT_REQUIRED");
  assert.equal(json.currency, "NGN");
  assert.equal(canadaRuntimeChecks, 1);
});

void test("non-Canada submit does not invoke the guarded Canada runtime adapter", async () => {
  const listing: ListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "draft",
    submitted_at: null,
    country_code: "NG",
    listing_intent: "rent",
    rental_type: "long_term",
  };
  const { supabase } = buildSupabaseStub(listing, {
    activeCount: 3,
    planTier: "starter",
    maxListingsOverride: 5,
  });
  const typedSupabase = supabase as ReturnType<
    ListingSubmitDeps["createServerSupabaseClient"]
  >;
  let canadaRuntimeChecks = 0;

  const deps: ListingSubmitDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => typedSupabase,
    createServiceRoleClient: () =>
      typedSupabase as ReturnType<ListingSubmitDeps["createServiceRoleClient"]>,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase: typedSupabase,
      }) as Awaited<ReturnType<ListingSubmitDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => ({ ok: false, reason: "NO_CREDITS" }),
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    getAppSettingBool: async () => false,
    getListingExpiryDays: async () => 90,
    requireLegalAcceptance: async () => ({ ok: true, status: {} }) as Awaited<
      ReturnType<ListingSubmitDeps["requireLegalAcceptance"]>
    >,
    logPropertyEvent: async () => ({ ok: true, data: {} }),
    resolveEventSessionKey: () => null,
    logFailure: () => undefined,
    loadCanadaRentalPaygRuntimeDecision: async () => {
      canadaRuntimeChecks += 1;
      throw new Error("should not be called");
    },
  };

  const res = await postPropertySubmitResponse(
    makeRequest({ idempotencyKey: "idem-ng-legacy" }),
    "prop1",
    deps
  );
  assert.equal(res.status, 402);
  const json = await res.json();
  assert.equal(json.reason, "PAYMENT_REQUIRED");
  assert.equal(canadaRuntimeChecks, 0);
});

void test("submit keeps entitlement server errors user-safe", async () => {
  const listing: ListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "draft",
    submitted_at: null,
  };
  const { supabase } = buildSupabaseStub(listing);
  const typedSupabase = supabase as ReturnType<
    ListingSubmitDeps["createServerSupabaseClient"]
  >;

  const deps: ListingSubmitDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => typedSupabase,
    createServiceRoleClient: () =>
      typedSupabase as ReturnType<ListingSubmitDeps["createServiceRoleClient"]>,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase: typedSupabase,
      }) as Awaited<ReturnType<ListingSubmitDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => ({
      ok: false,
      reason: 'Could not find the "listing_credit_consumptions" table in the schema cache',
    }),
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    getAppSettingBool: async () => false,
    getListingExpiryDays: async () => 90,
    requireLegalAcceptance: async () => ({ ok: true, status: {} }) as Awaited<
      ReturnType<ListingSubmitDeps["requireLegalAcceptance"]>
    >,
    logPropertyEvent: async () => ({ ok: true, data: {} }),
    resolveEventSessionKey: () => null,
    logFailure: () => undefined,
  };

  const res = await postPropertySubmitResponse(
    makeRequest({ idempotencyKey: "idem-submit-server-error" }),
    "prop1",
    deps
  );
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.code, "SERVER_ERROR");
  assert.equal(body.error, "We couldn’t submit this listing right now. Try again in a moment.");
});

void test("expired listing resubmission still requires payment when no entitlement exists", async () => {
  const listing: ListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "expired",
    submitted_at: "2026-04-01T00:00:00.000Z",
  };
  const { supabase } = buildSupabaseStub(listing);
  const typedSupabase = supabase as ReturnType<
    ListingSubmitDeps["createServerSupabaseClient"]
  >;

  const deps: ListingSubmitDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => typedSupabase,
    createServiceRoleClient: () =>
      typedSupabase as ReturnType<ListingSubmitDeps["createServiceRoleClient"]>,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase: typedSupabase,
      }) as Awaited<ReturnType<ListingSubmitDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => ({ ok: false, reason: "NO_CREDITS" }),
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    getAppSettingBool: async () => false,
    getListingExpiryDays: async () => 90,
    requireLegalAcceptance: async () => ({ ok: true, status: {} }) as Awaited<
      ReturnType<ListingSubmitDeps["requireLegalAcceptance"]>
    >,
    logPropertyEvent: async () => ({ ok: true, data: {} }),
    resolveEventSessionKey: () => null,
    logFailure: () => undefined,
  };

  const res = await postPropertySubmitResponse(
    makeRequest({ idempotencyKey: "idem-renew" }),
    "prop1",
    deps
  );
  assert.equal(res.status, 402);
  const json = await res.json();
  assert.equal(json.reason, "PAYMENT_REQUIRED");
  assert.match(String(json.resumeUrl ?? ""), /^\/host\/properties\/prop1\/edit\?/);
  assert.match(String(json.resumeUrl ?? ""), /monetization_context=renewal/);
});

void test("submit blocks shortlet listing when nightly price is missing", async () => {
  const listing: ListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "draft",
    submitted_at: null,
    listing_intent: "shortlet",
    rental_type: "short_let",
  };
  const { supabase } = buildSupabaseStub(listing, { nightlyPriceMinor: null });
  const typedSupabase = supabase as ReturnType<
    ListingSubmitDeps["createServerSupabaseClient"]
  >;

  const deps: ListingSubmitDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => typedSupabase,
    createServiceRoleClient: () =>
      typedSupabase as ReturnType<ListingSubmitDeps["createServiceRoleClient"]>,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase: typedSupabase,
      }) as Awaited<ReturnType<ListingSubmitDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => ({ ok: false, reason: "NO_CREDITS" }),
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    getAppSettingBool: async () => false,
    getListingExpiryDays: async () => 90,
    requireLegalAcceptance: async () => ({ ok: true, status: {} }) as Awaited<
      ReturnType<ListingSubmitDeps["requireLegalAcceptance"]>
    >,
    logPropertyEvent: async () => ({ ok: true, data: {} }),
    resolveEventSessionKey: () => null,
    logFailure: () => undefined,
  };

  const res = await postPropertySubmitResponse(makeRequest({ idempotencyKey: "idem-shortlet" }), "prop1", deps);
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.code, "SHORTLET_NIGHTLY_PRICE_REQUIRED");
});

void test("submit keeps pending flow when auto-approve flag is disabled", async () => {
  const listing: ListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "draft",
    submitted_at: null,
  };
  const { supabase, getLastPropertyUpdate } = buildSupabaseStub(listing, {
    nightlyPriceMinor: 240000,
  });
  const typedSupabase = supabase as ReturnType<
    ListingSubmitDeps["createServerSupabaseClient"]
  >;
  const events: string[] = [];

  const deps: ListingSubmitDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => typedSupabase,
    createServiceRoleClient: () =>
      typedSupabase as ReturnType<ListingSubmitDeps["createServiceRoleClient"]>,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase: typedSupabase,
      }) as Awaited<ReturnType<ListingSubmitDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => ({ ok: true, consumed: false }),
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    getAppSettingBool: async () => false,
    getListingExpiryDays: async () => 90,
    requireLegalAcceptance: async () => ({ ok: true, status: {} }) as Awaited<
      ReturnType<ListingSubmitDeps["requireLegalAcceptance"]>
    >,
    logPropertyEvent: async ({ eventType }) => {
      events.push(eventType);
      return { ok: true, data: {} };
    },
    resolveEventSessionKey: () => null,
    logFailure: () => undefined,
  };

  const res = await postPropertySubmitResponse(makeRequest({ idempotencyKey: "idem-pending" }), "prop1", deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "pending");
  assert.equal(body.autoApproved, false);

  const update = getLastPropertyUpdate();
  assert.equal(update?.status, "pending");
  assert.equal(update?.is_approved, false);
  assert.equal(update?.approved_at, null);
  assert.ok(events.includes("listing_submit_attempted"));
  assert.ok(!events.includes("listing_auto_approved"));
});

void test("submit sends admin review email notification when listing enters pending review", async () => {
  const listing: ListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "draft",
    submitted_at: null,
  };
  const { supabase } = buildSupabaseStub(listing, {
    nightlyPriceMinor: 240000,
  });
  const typedSupabase = supabase as ReturnType<
    ListingSubmitDeps["createServerSupabaseClient"]
  >;
  let notificationPayload: Record<string, unknown> | null = null;

  const deps: ListingSubmitDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => typedSupabase,
    createServiceRoleClient: () =>
      typedSupabase as ReturnType<ListingSubmitDeps["createServiceRoleClient"]>,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner", user_metadata: { full_name: "Ada Host" } } as User,
        supabase: typedSupabase,
      }) as Awaited<ReturnType<ListingSubmitDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => ({ ok: true, consumed: false }),
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    getAppSettingBool: async () => false,
    getListingExpiryDays: async () => 90,
    requireLegalAcceptance: async () => ({ ok: true, status: {} }) as Awaited<
      ReturnType<ListingSubmitDeps["requireLegalAcceptance"]>
    >,
    logPropertyEvent: async () => ({ ok: true, data: {} }),
    resolveEventSessionKey: () => null,
    logFailure: () => undefined,
    notifyAdminsOfListingReviewSubmission: async (input) => {
      notificationPayload = input as unknown as Record<string, unknown>;
      return { ok: true, attempted: 1, sent: 1, skipped: 0 };
    },
  };

  const res = await postPropertySubmitResponse(
    makeRequest({ idempotencyKey: "idem-review-email" }),
    "prop1",
    deps
  );

  assert.equal(res.status, 200);
  assert.equal(notificationPayload?.propertyId, "prop1");
  assert.equal(notificationPayload?.listingTitle, null);
  assert.equal(notificationPayload?.ownerName, "Ada Host");
  assert.equal(notificationPayload?.intentLabel, null);
});

void test("submit does not send admin review email notification when listing auto-approves live", async () => {
  const listing: ListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "draft",
    submitted_at: null,
  };
  const { supabase } = buildSupabaseStub(listing, {
    nightlyPriceMinor: 240000,
  });
  const typedSupabase = supabase as ReturnType<
    ListingSubmitDeps["createServerSupabaseClient"]
  >;
  let called = false;

  const deps: ListingSubmitDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => typedSupabase,
    createServiceRoleClient: () =>
      typedSupabase as ReturnType<ListingSubmitDeps["createServiceRoleClient"]>,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase: typedSupabase,
      }) as Awaited<ReturnType<ListingSubmitDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => ({ ok: true, consumed: false }),
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    getAppSettingBool: async (key) => key === "listings_auto_approve_enabled",
    getListingExpiryDays: async () => 120,
    requireLegalAcceptance: async () => ({ ok: true, status: {} }) as Awaited<
      ReturnType<ListingSubmitDeps["requireLegalAcceptance"]>
    >,
    logPropertyEvent: async () => ({ ok: true, data: {} }),
    resolveEventSessionKey: () => null,
    logFailure: () => undefined,
    notifyAdminsOfListingReviewSubmission: async () => {
      called = true;
      return { ok: true, attempted: 1, sent: 1, skipped: 0 };
    },
  };

  const res = await postPropertySubmitResponse(
    makeRequest({ idempotencyKey: "idem-auto-live" }),
    "prop1",
    deps
  );

  assert.equal(res.status, 200);
  assert.equal(called, false);
});

void test("submit attaches listing quality telemetry to submit attempt event", async () => {
  const listing: ListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "draft",
    submitted_at: null,
  };
  const { supabase } = buildSupabaseStub(listing, {
    nightlyPriceMinor: 240000,
  });
  const typedSupabase = supabase as ReturnType<
    ListingSubmitDeps["createServerSupabaseClient"]
  >;
  let submitAttemptMeta: Record<string, unknown> | null = null;

  const deps: ListingSubmitDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => typedSupabase,
    createServiceRoleClient: () =>
      typedSupabase as ReturnType<ListingSubmitDeps["createServiceRoleClient"]>,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase: typedSupabase,
      }) as Awaited<ReturnType<ListingSubmitDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => ({ ok: true, consumed: false }),
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    getAppSettingBool: async () => false,
    getListingExpiryDays: async () => 90,
    requireLegalAcceptance: async () => ({ ok: true, status: {} }) as Awaited<
      ReturnType<ListingSubmitDeps["requireLegalAcceptance"]>
    >,
    logPropertyEvent: async ({ eventType, meta }) => {
      if (eventType === "listing_submit_attempted") {
        submitAttemptMeta = (meta as Record<string, unknown> | null) ?? null;
      }
      return { ok: true, data: {} };
    },
    resolveEventSessionKey: () => null,
    logFailure: () => undefined,
  };

  const res = await postPropertySubmitResponse(
    makeRequest({
      idempotencyKey: "idem-quality",
      qualityTelemetry: {
        source: "submit_step",
        bestNextFixKey: "missing_images",
        scoreBefore: 55,
        scoreAtSubmit: 80,
        scoreImproved: true,
        missingCountBefore: 4,
        missingCountAtSubmit: 1,
      },
    }),
    "prop1",
    deps
  );

  assert.equal(res.status, 200);
  assert.deepEqual(submitAttemptMeta, {
    quality_source: "submit_step",
    quality_best_next_fix_key: "missing_images",
    quality_score_before: 55,
    quality_score_at_submit: 80,
    quality_score_improved: true,
    quality_missing_count_before: 4,
    quality_missing_count_at_submit: 1,
  });
});

void test("submit auto-approves when listings auto-approve flag is enabled", async () => {
  const listing: ListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "draft",
    submitted_at: null,
  };
  const { supabase, getLastPropertyUpdate } = buildSupabaseStub(listing, {
    nightlyPriceMinor: 240000,
  });
  const typedSupabase = supabase as ReturnType<
    ListingSubmitDeps["createServerSupabaseClient"]
  >;
  const events: string[] = [];

  const deps: ListingSubmitDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => typedSupabase,
    createServiceRoleClient: () =>
      typedSupabase as ReturnType<ListingSubmitDeps["createServiceRoleClient"]>,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase: typedSupabase,
      }) as Awaited<ReturnType<ListingSubmitDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => ({ ok: true, consumed: false }),
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    getAppSettingBool: async (key) => key === "listings_auto_approve_enabled",
    getListingExpiryDays: async () => 120,
    requireLegalAcceptance: async () => ({ ok: true, status: {} }) as Awaited<
      ReturnType<ListingSubmitDeps["requireLegalAcceptance"]>
    >,
    logPropertyEvent: async ({ eventType }) => {
      events.push(eventType);
      return { ok: true, data: {} };
    },
    resolveEventSessionKey: () => null,
    logFailure: () => undefined,
  };

  const res = await postPropertySubmitResponse(makeRequest({ idempotencyKey: "idem-auto" }), "prop1", deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "live");
  assert.equal(body.autoApproved, true);

  const update = getLastPropertyUpdate();
  assert.equal(update?.status, "live");
  assert.equal(update?.is_approved, true);
  assert.equal(update?.is_active, true);
  assert.equal(typeof update?.approved_at, "string");
  assert.equal(typeof update?.expires_at, "string");
  assert.ok(events.includes("listing_auto_approved"));
});
