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
  listing_intent?: string | null;
  rental_type?: string | null;
};

const buildSupabaseStub = (
  listing: ListingRow,
  options?: { nightlyPriceMinor?: number | null }
) => {
  let lastPropertyUpdate: Record<string, unknown> | null = null;
  const supabase = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (table === "shortlet_settings") {
              return { data: { nightly_price_minor: options?.nightlyPriceMinor ?? null } };
            }
            return { data: listing };
          },
        }),
      }),
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
