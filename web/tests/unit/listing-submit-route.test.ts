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
) => ({
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
    update: () => ({
      eq: async () => ({ error: null }),
    }),
  }),
  rpc: async () => ({ data: { inserted: true } }),
});

void test("submit returns payment required when no credits", async () => {
  const listing: ListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "draft",
    submitted_at: null,
  };
  const supabase = buildSupabaseStub(listing) as ReturnType<
    ListingSubmitDeps["createServerSupabaseClient"]
  >;

  const deps: ListingSubmitDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () => supabase as ReturnType<ListingSubmitDeps["createServiceRoleClient"]>,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase,
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
  const supabase = buildSupabaseStub(listing, { nightlyPriceMinor: null }) as ReturnType<
    ListingSubmitDeps["createServerSupabaseClient"]
  >;

  const deps: ListingSubmitDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () => supabase as ReturnType<ListingSubmitDeps["createServiceRoleClient"]>,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase,
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
