import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  postFeaturedRequestResponse,
  type FeaturedRequestDeps,
} from "@/app/api/featured/requests/route";
import { DEFAULT_FEATURED_ELIGIBILITY_SETTINGS } from "@/lib/featured/eligibility";

type PropertyRow = {
  id: string;
  owner_id: string;
  title: string | null;
  city: string | null;
  status: string | null;
  is_active: boolean | null;
  is_approved: boolean | null;
  expires_at: string | null;
  is_demo: boolean | null;
  is_featured: boolean | null;
  featured_until: string | null;
  description: string | null;
  property_images?: Array<{ id: string | null }> | null;
};

type RequestRow = {
  id: string;
  property_id: string;
  requester_user_id: string;
  requester_role: string;
  duration_days: number | null;
  requested_until: string | null;
  note: string | null;
  status: string;
  admin_note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function makeRequest(payload: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/featured/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function makeClient(scenario: {
  property: PropertyRow;
  pending: RequestRow | null;
  inserted?: RequestRow | null;
  insertError?: { code?: string; message: string } | null;
  capture: { insertedPayload: Record<string, unknown> | null };
}) {
  return {
    from: (table: string) => {
      if (table === "properties") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: scenario.property, error: null }),
            }),
          }),
        };
      }

      if (table === "featured_requests") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: scenario.pending, error: null }),
              }),
            }),
          }),
          insert: (payload: Record<string, unknown>) => {
            scenario.capture.insertedPayload = payload;
            return {
              select: () => ({
                maybeSingle: async () => ({ data: scenario.inserted ?? null, error: scenario.insertError ?? null }),
              }),
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

function makeDeps(input: {
  role: "agent" | "landlord" | "tenant";
  userId?: string;
  property: PropertyRow;
  featuredSettings?: Partial<typeof DEFAULT_FEATURED_ELIGIBILITY_SETTINGS>;
  pending?: RequestRow | null;
  insertError?: { code?: string; message: string } | null;
  inserted?: RequestRow | null;
  delegationAllowed?: boolean;
  capture?: { insertedPayload: Record<string, unknown> | null };
}): FeaturedRequestDeps {
  const capture = input.capture ?? { insertedPayload: null as Record<string, unknown> | null };
  const client = makeClient({
    property: input.property,
    pending: input.pending ?? null,
    inserted: input.inserted ?? null,
    insertError: input.insertError ?? null,
    capture,
  });

  return {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServerSupabaseClient: async () =>
      ({} as ReturnType<FeaturedRequestDeps["createServerSupabaseClient"]>),
    createServiceRoleClient: () =>
      (client as unknown as ReturnType<FeaturedRequestDeps["createServiceRoleClient"]>),
    requireUser: async () =>
      ({
        ok: true,
        supabase: client,
        user: { id: input.userId || "user-1" } as User,
      }) as Awaited<ReturnType<FeaturedRequestDeps["requireUser"]>>,
    getUserRole: async () => input.role,
    hasActiveDelegation: async () => input.delegationAllowed ?? false,
    getFeaturedEligibilitySettings: async () => ({
      ...DEFAULT_FEATURED_ELIGIBILITY_SETTINGS,
      ...(input.featuredSettings ?? {}),
    }),
  };
}

void test("featured request create route validates ownership", async () => {
  const capture = { insertedPayload: null as Record<string, unknown> | null };
  const deps = makeDeps({
    role: "landlord",
    userId: "user-1",
    property: {
      id: "prop-1",
      owner_id: "other-owner",
      title: "Home",
      city: "Lagos",
      status: "live",
      is_active: true,
      is_approved: true,
      expires_at: null,
      is_demo: false,
      is_featured: false,
      featured_until: null,
      description: "Great apartment with ample natural light and modern fittings.",
      property_images: [{ id: "img-1" }, { id: "img-2" }, { id: "img-3" }],
    },
    capture,
  });

  const response = await postFeaturedRequestResponse(
    makeRequest({ propertyId: "11111111-1111-4111-8111-111111111111", durationDays: 7 }),
    deps
  );

  assert.equal(response.status, 403);
  assert.equal(capture.insertedPayload, null);
});

void test("featured request create route is idempotent when pending exists", async () => {
  const capture = { insertedPayload: null as Record<string, unknown> | null };
  const deps = makeDeps({
    role: "landlord",
    userId: "owner-1",
    property: {
      id: "prop-1",
      owner_id: "owner-1",
      title: "Home",
      city: "Abuja",
      status: "live",
      is_active: true,
      is_approved: true,
      expires_at: null,
      is_demo: false,
      is_featured: false,
      featured_until: null,
      description: "Great apartment with ample natural light and modern fittings.",
      property_images: [{ id: "img-1" }, { id: "img-2" }, { id: "img-3" }],
    },
    pending: {
      id: "req-1",
      property_id: "prop-1",
      requester_user_id: "owner-1",
      requester_role: "landlord",
      duration_days: 7,
      requested_until: null,
      note: null,
      status: "pending",
      admin_note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    capture,
  });

  const response = await postFeaturedRequestResponse(
    makeRequest({ propertyId: "22222222-2222-4222-8222-222222222222", durationDays: 7 }),
    deps
  );

  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.pending, true);
  assert.equal(json.message, "Request pending.");
  assert.equal(capture.insertedPayload, null);
});

void test("featured request create route rejects overly long note", async () => {
  const deps = makeDeps({
    role: "landlord",
    userId: "owner-1",
    property: {
      id: "prop-1",
      owner_id: "owner-1",
      title: "Home",
      city: "Abuja",
      status: "live",
      is_active: true,
      is_approved: true,
      expires_at: null,
      is_demo: false,
      is_featured: false,
      featured_until: null,
      description: "Great apartment with ample natural light and modern fittings.",
      property_images: [{ id: "img-1" }, { id: "img-2" }, { id: "img-3" }],
    },
  });

  const response = await postFeaturedRequestResponse(
    makeRequest({
      propertyId: "33333333-3333-4333-8333-333333333333",
      durationDays: 7,
      note: "x".repeat(281),
    }),
    deps
  );

  assert.equal(response.status, 422);
});

void test("featured request create route blocks demo listings", async () => {
  const capture = { insertedPayload: null as Record<string, unknown> | null };
  const deps = makeDeps({
    role: "agent",
    userId: "owner-1",
    property: {
      id: "prop-1",
      owner_id: "owner-1",
      title: "Demo",
      city: "Abuja",
      status: "live",
      is_active: true,
      is_approved: true,
      expires_at: null,
      is_demo: true,
      is_featured: false,
      featured_until: null,
      description: "Demo listing only.",
      property_images: [{ id: "img-1" }, { id: "img-2" }, { id: "img-3" }],
    },
    capture,
  });

  const response = await postFeaturedRequestResponse(
    makeRequest({ propertyId: "44444444-4444-4444-8444-444444444444", durationDays: 30 }),
    deps
  );

  assert.equal(response.status, 409);
  const json = await response.json();
  assert.equal(json.error, "Demo listings can't request featured.");
  assert.equal(capture.insertedPayload, null);
});

void test("featured request route blocks when requests are paused", async () => {
  const deps = makeDeps({
    role: "agent",
    userId: "owner-1",
    property: {
      id: "prop-1",
      owner_id: "owner-1",
      title: "Live listing",
      city: "Abuja",
      status: "live",
      is_active: true,
      is_approved: true,
      expires_at: null,
      is_demo: false,
      is_featured: false,
      featured_until: null,
      description: "Great apartment with ample natural light and modern fittings.",
      property_images: [{ id: "img-1" }, { id: "img-2" }, { id: "img-3" }],
    },
    featuredSettings: { requestsEnabled: false },
  });

  const response = await postFeaturedRequestResponse(
    makeRequest({ propertyId: "55555555-5555-4555-8555-555555555555", durationDays: 7 }),
    deps
  );

  assert.equal(response.status, 403);
  const json = await response.json();
  assert.equal(json.error, "Featured requests are currently paused.");
});

void test("featured request route blocks when listing has fewer photos than required", async () => {
  const deps = makeDeps({
    role: "landlord",
    userId: "owner-1",
    property: {
      id: "prop-1",
      owner_id: "owner-1",
      title: "Live listing",
      city: "Abuja",
      status: "live",
      is_active: true,
      is_approved: true,
      expires_at: null,
      is_demo: false,
      is_featured: false,
      featured_until: null,
      description: "Great apartment with ample natural light and modern fittings.",
      property_images: [{ id: "img-1" }],
    },
    featuredSettings: { minPhotos: 3 },
  });

  const response = await postFeaturedRequestResponse(
    makeRequest({ propertyId: "66666666-6666-4666-8666-666666666666", durationDays: 7 }),
    deps
  );

  assert.equal(response.status, 409);
  const json = await response.json();
  assert.equal(json.error, "Add at least 3 photos.");
});

void test("featured requests migration includes owner/admin/service policies", async () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260212133000_featured_requests_v1_1.sql"
  );
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /create table if not exists public\.featured_requests/i);
  assert.match(sql, /create policy "featured requests requester insert"/i);
  assert.match(sql, /create policy "featured requests admin update"/i);
  assert.match(sql, /create policy "featured requests service all"/i);
});
