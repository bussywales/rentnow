import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { postPropertyStatusResponse, type ListingStatusDeps } from "@/app/api/properties/[id]/status/route";

const makeRequest = (payload: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/properties/prop1/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

type ListingRow = {
  id: string;
  owner_id: string;
  status: string;
  is_active: boolean;
  is_approved: boolean;
  approved_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  location_place_id?: string | null;
};

const buildSupabaseStub = (
  listing: ListingRow,
  capture: { updatePayload: Record<string, unknown> | null }
) => {
  const legalDocs = [
    {
      id: "doc-master",
      jurisdiction: "NG",
      audience: "MASTER",
      version: 1,
      status: "published",
      title: "Master",
      content_md: "",
      effective_at: null,
      published_at: null,
      updated_at: null,
      created_at: null,
    },
    {
      id: "doc-aup",
      jurisdiction: "NG",
      audience: "AUP",
      version: 1,
      status: "published",
      title: "AUP",
      content_md: "",
      effective_at: null,
      published_at: null,
      updated_at: null,
      created_at: null,
    },
    {
      id: "doc-disclaimer",
      jurisdiction: "NG",
      audience: "DISCLAIMER",
      version: 1,
      status: "published",
      title: "Disclaimer",
      content_md: "",
      effective_at: null,
      published_at: null,
      updated_at: null,
      created_at: null,
    },
    {
      id: "doc-landlord",
      jurisdiction: "NG",
      audience: "LANDLORD_AGENT",
      version: 1,
      status: "published",
      title: "Landlord",
      content_md: "",
      effective_at: null,
      published_at: null,
      updated_at: null,
      created_at: null,
    },
  ];
  const legalAcceptances = legalDocs.map((doc) => ({
    audience: doc.audience,
    version: doc.version,
    document_id: doc.id,
  }));

  return {
    from: (table: string) => {
      if (table === "legal_documents") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                or: () => ({
                  in: () => ({
                    order: async () => ({ data: legalDocs, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "legal_acceptances") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: async () => ({ data: legalAcceptances }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: listing }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          capture.updatePayload = payload;
          return {
            eq: () => ({
              select: () => ({
                maybeSingle: async () => ({ data: { ...listing, ...payload } }),
              }),
            }),
          };
        },
      };
    },
  };
};

void test("owner can pause listing", async () => {
  const capture = { updatePayload: null as Record<string, unknown> | null };
  const listing: ListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "live",
    is_active: true,
    is_approved: true,
  };

  const supabase = buildSupabaseStub(listing, capture) as ReturnType<
    ListingStatusDeps["createServerSupabaseClient"]
  >;
  const deps: ListingStatusDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () =>
      (supabase as unknown as ReturnType<ListingStatusDeps["createServiceRoleClient"]>),
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase,
      }) as Awaited<ReturnType<ListingStatusDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    getAppSettingBool: async () => false,
    getListingExpiryDays: async () => 90,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => ({ ok: true, consumed: false, alreadyConsumed: true, source: "payg", creditId: null, idempotencyKey: "idem" }),
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    dispatchSavedSearchAlerts: async () => ({ ok: true }),
    logFailure: () => undefined,
  };

  const res = await postPropertyStatusResponse(
    makeRequest({ status: "paused_owner", paused_reason: "owner_hold" }),
    "prop1",
    deps
  );
  assert.equal(res.status, 200);
  assert.equal(capture.updatePayload?.status, "paused_owner");
  assert.equal(capture.updatePayload?.is_active, false);
  assert.equal(capture.updatePayload?.paused_reason, "owner_hold");
  assert.ok(typeof capture.updatePayload?.paused_at === "string");
});

void test("owner can reactivate listing", async () => {
  const capture = { updatePayload: null as Record<string, unknown> | null };
  const listing: ListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "paused_owner",
    is_active: false,
    is_approved: true,
    latitude: 1,
    longitude: 2,
  };

  const supabase = buildSupabaseStub(listing, capture) as ReturnType<
    ListingStatusDeps["createServerSupabaseClient"]
  >;
  const deps: ListingStatusDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () =>
      (supabase as unknown as ReturnType<ListingStatusDeps["createServiceRoleClient"]>),
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase,
      }) as Awaited<ReturnType<ListingStatusDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    getAppSettingBool: async () => false,
    getListingExpiryDays: async () => 30,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => ({ ok: true, consumed: false, alreadyConsumed: true, source: "payg", creditId: null, idempotencyKey: "idem" }),
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    dispatchSavedSearchAlerts: async () => ({ ok: true }),
    logFailure: () => undefined,
  };

  const res = await postPropertyStatusResponse(
    makeRequest({ status: "live" }),
    "prop1",
    deps
  );
  assert.equal(res.status, 200);
  assert.equal(capture.updatePayload?.status, "live");
  assert.equal(capture.updatePayload?.is_active, true);
  assert.equal(capture.updatePayload?.is_approved, true);
  assert.equal(capture.updatePayload?.paused_at, null);
  assert.equal(capture.updatePayload?.paused_reason, null);
  assert.ok(typeof capture.updatePayload?.reactivated_at === "string");
  assert.ok(typeof capture.updatePayload?.expires_at === "string");
});

void test("tenant cannot update listing status", async () => {
  const listing: ListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "live",
    is_active: true,
    is_approved: true,
  };

  const supabase = buildSupabaseStub(listing, { updatePayload: null }) as ReturnType<
    ListingStatusDeps["createServerSupabaseClient"]
  >;
  const deps: ListingStatusDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () =>
      ({} as ReturnType<ListingStatusDeps["createServiceRoleClient"]>),
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "tenant" } as User,
        supabase,
      }) as Awaited<ReturnType<ListingStatusDeps["requireUser"]>>,
    getUserRole: async () => "tenant",
    getListingAccessResult: () => ({
      ok: false,
      status: 403,
      code: "role_not_allowed",
      message: "Tenants can't list properties.",
    }),
    hasActiveDelegation: async () => false,
    getAppSettingBool: async () => false,
    getListingExpiryDays: async () => 30,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => ({ ok: true, consumed: false, alreadyConsumed: true, source: "payg", creditId: null, idempotencyKey: "idem" }),
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    dispatchSavedSearchAlerts: async () => ({ ok: true }),
    logFailure: () => undefined,
  };

  const res = await postPropertyStatusResponse(
    makeRequest({ status: "paused_owner", paused_reason: "owner_hold" }),
    "prop1",
    deps
  );
  assert.equal(res.status, 403);
});

void test("reactivation returns payment required when no listing entitlement exists", async () => {
  const capture = { updatePayload: null as Record<string, unknown> | null };
  const listing: ListingRow = {
    id: "prop1",
    owner_id: "owner",
    status: "paused_owner",
    is_active: false,
    is_approved: true,
    latitude: 1,
    longitude: 2,
  };

  const supabase = buildSupabaseStub(listing, capture) as ReturnType<
    ListingStatusDeps["createServerSupabaseClient"]
  >;
  const deps: ListingStatusDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () =>
      (supabase as unknown as ReturnType<ListingStatusDeps["createServiceRoleClient"]>),
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase,
      }) as Awaited<ReturnType<ListingStatusDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    getAppSettingBool: async () => false,
    getListingExpiryDays: async () => 30,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => ({ ok: false, reason: "NO_CREDITS" }),
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
    dispatchSavedSearchAlerts: async () => ({ ok: true }),
    logFailure: () => undefined,
  };

  const res = await postPropertyStatusResponse(
    makeRequest({ status: "live" }),
    "prop1",
    deps
  );
  assert.equal(res.status, 402);
  const body = await res.json();
  assert.equal(body.reason, "PAYMENT_REQUIRED");
  assert.equal(body.billingUrl, "/dashboard/billing#plans");
  assert.match(String(body.resumeUrl ?? ""), /monetization_context=reactivation/);
  assert.equal(capture.updatePayload, null);
});
