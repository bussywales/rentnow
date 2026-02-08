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
};

const buildSupabaseStub = (listing: ListingRow) => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: listing }),
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
