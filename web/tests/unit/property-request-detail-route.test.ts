import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  getPropertyRequestDetailResponse,
  type PropertyRequestDetailRouteDeps,
} from "@/app/api/requests/[id]/route";
import type { PropertyRequestRecord } from "@/lib/requests/property-requests";

const makeRequest = () =>
  new NextRequest("http://localhost/api/requests/req-1", { method: "GET" });

const openRow: PropertyRequestRecord = {
  id: "req-1",
  owner_user_id: "tenant-1",
  owner_role: "tenant",
  intent: "rent",
  market_code: "NG",
  currency_code: "NGN",
  city: "Lagos",
  area: null,
  location_text: "Lekki",
  budget_min: 100000,
  budget_max: 300000,
  property_type: "apartment",
  bedrooms: 2,
  bathrooms: 2,
  furnished: null,
  move_timeline: "soon",
  shortlet_duration: null,
  notes: null,
  status: "open",
  published_at: "2026-03-16T10:00:00.000Z",
  expires_at: "2026-04-15T10:00:00.000Z",
  created_at: "2026-03-16T10:00:00.000Z",
  updated_at: "2026-03-16T10:00:00.000Z",
};

function buildDeps(
  input: Partial<PropertyRequestDetailRouteDeps> & {
    role?: "tenant" | "landlord" | "agent" | "admin" | null;
    userId?: string;
  } = {}
): PropertyRequestDetailRouteDeps {
  const role = input.role ?? "tenant";
  const userId = input.userId ?? "tenant-1";
  return {
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () => ({}) as never,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: userId } as User,
        supabase: {} as never,
      }) as Awaited<ReturnType<PropertyRequestDetailRouteDeps["requireUser"]>>,
    getUserRole: async () => role,
    loadRequest: async () => ({ data: openRow, error: null }),
    ...input,
  };
}

void test("property request detail preserves auth failures", async () => {
  const response = await getPropertyRequestDetailResponse(makeRequest(), "req-1", {
    ...buildDeps(),
    requireUser: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }) as Awaited<ReturnType<PropertyRequestDetailRouteDeps["requireUser"]>>,
  });

  assert.equal(response.status, 401);
});

void test("property request detail returns 404 for hidden rows", async () => {
  const response = await getPropertyRequestDetailResponse(
    makeRequest(),
    "req-1",
    buildDeps({
      role: "tenant",
      userId: "tenant-2",
      loadRequest: async () => ({ data: openRow, error: null }),
    })
  );

  assert.equal(response.status, 404);
});

void test("property request detail allows responders to open published requests", async () => {
  const response = await getPropertyRequestDetailResponse(
    makeRequest(),
    "req-1",
    buildDeps({ role: "agent", userId: "agent-1" })
  );
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.item.id, "req-1");
  assert.equal(json.viewerCanEdit, false);
});

void test("property request detail allows owners and admins to edit-visible rows", async () => {
  const ownerResponse = await getPropertyRequestDetailResponse(
    makeRequest(),
    "req-1",
    buildDeps({ role: "tenant", userId: "tenant-1" })
  );
  const ownerJson = await ownerResponse.json();
  assert.equal(ownerJson.viewerCanEdit, true);

  const adminResponse = await getPropertyRequestDetailResponse(
    makeRequest(),
    "req-1",
    buildDeps({
      role: "admin",
      userId: "admin-1",
      loadRequest: async () => ({
        data: { ...openRow, status: "draft", published_at: null },
        error: null,
      }),
    })
  );
  const adminJson = await adminResponse.json();
  assert.equal(adminResponse.status, 200);
  assert.equal(adminJson.viewerCanEdit, true);
});
