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

const buildSupabaseStub = (listing: ListingRow, capture: { updatePayload: Record<string, unknown> | null }) => ({
  from: () => ({
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
  }),
});

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
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () =>
      ({} as ReturnType<ListingStatusDeps["createServiceRoleClient"]>),
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
    getPlanUsage: async () => ({
      activeCount: 0,
      plan: { maxListings: 10, tier: "starter" },
      source: "plan",
    }),
    getListingExpiryDays: async () => 90,
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
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () =>
      ({} as ReturnType<ListingStatusDeps["createServiceRoleClient"]>),
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
    getPlanUsage: async () => ({
      activeCount: 0,
      plan: { maxListings: 10, tier: "starter" },
      source: "plan",
    }),
    getListingExpiryDays: async () => 30,
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
    getPlanUsage: async () => ({
      activeCount: 0,
      plan: { maxListings: 10, tier: "starter" },
      source: "plan",
    }),
    getListingExpiryDays: async () => 30,
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
