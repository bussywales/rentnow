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
  capture: { updatePayload: Record<string, unknown> | null },
  options?: {
    activeCount?: number;
    planTier?: string;
    maxListingsOverride?: number | null;
    validUntil?: string | null;
  }
) =>
  ({
    from: (table: string) => ({
      select: (...args: unknown[]) => {
        const selectOptions = args[1] as { count?: string; head?: boolean } | undefined;
        if (table === "properties" && selectOptions?.count === "exact" && selectOptions?.head) {
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
        }
        return {
          eq: () => ({
            maybeSingle: async () =>
              table === "properties"
                ? { data: property }
                : table === "profile_plans"
                  ? {
                      data: {
                        plan_tier: options?.planTier ?? "free",
                        max_listings_override: options?.maxListingsOverride ?? null,
                        valid_until: options?.validUntil ?? null,
                      },
                      error: null,
                    }
                  : { data: { role: "landlord" } },
          }),
        };
      },
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

void test("renew succeeds when consumeListingCredit reports the request was already handled idempotently", async () => {
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

void test("renew blocks when active listing limit is already reached", async () => {
  const capture = { updatePayload: null as Record<string, unknown> | null };
  const supabase = buildSupabaseStub(
    {
      id: "prop1",
      owner_id: "owner",
      status: "expired",
      expires_at: "2026-04-01T00:00:00.000Z",
    },
    capture,
    {
      activeCount: 5,
      planTier: "starter",
      maxListingsOverride: 5,
    }
  );
  let consumedAttempted = false;

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
    consumeListingCredit: async () => {
      consumedAttempted = true;
      return {
        ok: true,
        consumed: true,
        alreadyConsumed: false,
        source: "payg",
        creditId: "credit-1",
        idempotencyKey: "idem-renew-limit",
      };
    },
    issueTrialCreditsIfEligible: async () => ({ issued: false }),
  };

  const res = await postPropertyRenewResponse(makeRequest(), "prop1", deps);
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.code, "plan_limit_reached");
  assert.equal(body.maxListings, 5);
  assert.equal(body.activeCount, 5);
  assert.equal(consumedAttempted, false);
  assert.equal(capture.updatePayload, null);
});
