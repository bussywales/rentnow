import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  postPropertyRenewResponse,
  type RenewDeps,
} from "@/app/api/properties/[id]/renew/route";

const makeRequest = () =>
  new NextRequest("http://localhost/api/properties/prop1/renew", {
    method: "POST",
  });

type PropertyRow = {
  id: string;
  owner_id: string;
  status: string;
  expires_at?: string | null;
};

const buildSupabaseStub = (
  property: PropertyRow,
  capture: { updatePayload: Record<string, unknown> | null }
) =>
  ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "properties"
              ? { data: property }
              : { data: { role: "landlord" } },
        }),
      }),
      update: (payload: Record<string, unknown>) => ({
        eq: async () => {
          capture.updatePayload = payload;
          return { error: null };
        },
      }),
    }),
  }) as unknown as ReturnType<RenewDeps["createServerSupabaseClient"]>;

void test("renew returns payment required when no listing entitlement exists", async () => {
  const capture = { updatePayload: null as Record<string, unknown> | null };
  const supabase = buildSupabaseStub(
    {
      id: "prop1",
      owner_id: "owner",
      status: "expired",
      expires_at: "2026-04-01T00:00:00.000Z",
    },
    capture
  );

  const deps: RenewDeps = {
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () => supabase,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase,
      }) as Awaited<ReturnType<RenewDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () =>
      (supabase as unknown as ReturnType<RenewDeps["createServiceRoleClient"]>),
    getListingExpiryDays: async () => 90,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => ({ ok: false, reason: "NO_CREDITS" }),
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
  };

  const res = await postPropertyRenewResponse(makeRequest(), "prop1", deps);
  assert.equal(res.status, 402);
  const body = await res.json();
  assert.equal(body.reason, "PAYMENT_REQUIRED");
  assert.equal(body.billingUrl, "/dashboard/billing#plans");
  assert.match(String(body.resumeUrl ?? ""), /monetization_context=renewal/);
  assert.equal(capture.updatePayload, null);
});

void test("renew succeeds when listing already has a valid one-off entitlement", async () => {
  const capture = { updatePayload: null as Record<string, unknown> | null };
  const supabase = buildSupabaseStub(
    {
      id: "prop1",
      owner_id: "owner",
      status: "expired",
      expires_at: "2026-04-01T00:00:00.000Z",
    },
    capture
  );

  const deps: RenewDeps = {
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () => supabase,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "owner" } as User,
        supabase,
      }) as Awaited<ReturnType<RenewDeps["requireUser"]>>,
    getUserRole: async () => "landlord",
    getListingAccessResult: () => ({ ok: true }),
    hasActiveDelegation: async () => false,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () =>
      (supabase as unknown as ReturnType<RenewDeps["createServiceRoleClient"]>),
    getListingExpiryDays: async () => 90,
    getPaygConfig: async () => ({
      enabled: true,
      amount: 2000,
      currency: "NGN",
      trialAgentCredits: 0,
      trialLandlordCredits: 0,
    }),
    consumeListingCredit: async () => ({
      ok: true,
      consumed: false,
      alreadyConsumed: true,
      source: "payg",
      creditId: "credit-1",
      idempotencyKey: "idem-1",
    }),
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
  };

  const res = await postPropertyRenewResponse(makeRequest(), "prop1", deps);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.status, "live");
  assert.ok(capture.updatePayload);
});
