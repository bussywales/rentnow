import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  postPropertyQualityGuidanceResponse,
  type ListingQualityTelemetryRouteDeps,
} from "@/app/api/properties/[id]/quality-guidance/route";

const makeRequest = (payload: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/properties/prop-1/quality-guidance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

void test("quality guidance route records viewed telemetry for owned listings", async () => {
  let logged: Record<string, unknown> | null = null;
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: "prop-1", owner_id: "owner-1" } }),
        }),
      }),
    }),
  } as ReturnType<ListingQualityTelemetryRouteDeps["createServerSupabaseClient"]>;

  const deps: ListingQualityTelemetryRouteDeps = {
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () => supabase,
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "owner-1" } as User,
        role: "landlord",
      }) as Awaited<ReturnType<ListingQualityTelemetryRouteDeps["requireRole"]>>,
    requireOwnership: () => ({ ok: true }),
    getUserRole: async () => "landlord",
    hasActiveDelegation: async () => false,
    logPropertyEvent: async (input) => {
      logged = input as unknown as Record<string, unknown>;
      return { ok: true, data: {} };
    },
    resolveEventSessionKey: () => "session-1",
    logFailure: () => undefined,
  };

  const res = await postPropertyQualityGuidanceResponse(
    makeRequest({
      eventType: "listing_quality_guidance_viewed",
      payload: {
        source: "submit_step",
        bestNextFixKey: "missing_images",
        scoreBefore: 52,
        missingCountBefore: 4,
      },
    }),
    "prop-1",
    deps
  );

  assert.equal(res.status, 200);
  assert.equal(logged?.eventType, "listing_quality_guidance_viewed");
  assert.deepEqual(logged?.meta, {
    source: "submit_step",
    best_next_fix_key: "missing_images",
    score_before: 52,
    missing_count_before: 4,
  });
});

void test("quality guidance route records fix click telemetry with target step", async () => {
  let logged: Record<string, unknown> | null = null;
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: "prop-1", owner_id: "owner-1" } }),
        }),
      }),
    }),
  } as ReturnType<ListingQualityTelemetryRouteDeps["createServerSupabaseClient"]>;

  const deps: ListingQualityTelemetryRouteDeps = {
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () => supabase,
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "owner-1" } as User,
        role: "landlord",
      }) as Awaited<ReturnType<ListingQualityTelemetryRouteDeps["requireRole"]>>,
    requireOwnership: () => ({ ok: true }),
    getUserRole: async () => "landlord",
    hasActiveDelegation: async () => false,
    logPropertyEvent: async (input) => {
      logged = input as unknown as Record<string, unknown>;
      return { ok: true, data: {} };
    },
    resolveEventSessionKey: () => "session-1",
    logFailure: () => undefined,
  };

  const res = await postPropertyQualityGuidanceResponse(
    makeRequest({
      eventType: "listing_quality_fix_clicked",
      payload: {
        source: "submit_step",
        bestNextFixKey: "missing_images",
        clickedFixKey: "missing_description",
        targetStep: "details",
        scoreBefore: 52,
        missingCountBefore: 4,
      },
    }),
    "prop-1",
    deps
  );

  assert.equal(res.status, 200);
  assert.equal(logged?.eventType, "listing_quality_fix_clicked");
  assert.deepEqual(logged?.meta, {
    source: "submit_step",
    best_next_fix_key: "missing_images",
    clicked_fix_key: "missing_description",
    target_step: "details",
    score_before: 52,
    missing_count_before: 4,
  });
});

void test("quality guidance route preserves auth failures", async () => {
  const deps: ListingQualityTelemetryRouteDeps = {
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () =>
      ({} as ReturnType<ListingQualityTelemetryRouteDeps["createServerSupabaseClient"]>),
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }) as Awaited<ReturnType<ListingQualityTelemetryRouteDeps["requireRole"]>>,
    requireOwnership: () => ({ ok: true }),
    getUserRole: async () => "landlord",
    hasActiveDelegation: async () => false,
    logPropertyEvent: async () => ({ ok: true, data: {} }),
    resolveEventSessionKey: () => null,
    logFailure: () => undefined,
  };

  const res = await postPropertyQualityGuidanceResponse(
    makeRequest({
      eventType: "listing_quality_guidance_viewed",
      payload: {
        source: "submit_step",
        bestNextFixKey: null,
        scoreBefore: 100,
        missingCountBefore: 0,
      },
    }),
    "prop-1",
    deps
  );

  assert.equal(res.status, 401);
});
