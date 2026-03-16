import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  patchAdminPropertyRequestResponse,
  type AdminPropertyRequestRouteDeps,
} from "@/app/api/admin/requests/[id]/route";
import type { PropertyRequestRecord } from "@/lib/requests/property-requests";

const requestRow: PropertyRequestRecord = {
  id: "req-1",
  owner_user_id: "tenant-1",
  owner_role: "tenant",
  intent: "rent",
  market_code: "NG",
  currency_code: "NGN",
  city: "Lagos",
  area: "Lekki",
  location_text: null,
  budget_min: 100000,
  budget_max: 250000,
  property_type: "apartment",
  bedrooms: 2,
  bathrooms: 2,
  furnished: true,
  move_timeline: "within_30_days",
  shortlet_duration: null,
  notes: null,
  status: "open",
  published_at: "2026-03-10T10:00:00.000Z",
  expires_at: "2026-04-10T10:00:00.000Z",
  created_at: "2026-03-10T09:00:00.000Z",
  updated_at: "2026-03-10T10:00:00.000Z",
};

const makePatchRequest = (payload: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/admin/requests/req-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

function createProfileSupabase(role: string | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: role ? { role } : null, error: null }),
        }),
      }),
    }),
  } as unknown as Awaited<ReturnType<AdminPropertyRequestRouteDeps["getServerAuthUser"]>>["supabase"];
}

function buildDeps(
  overrides: Partial<AdminPropertyRequestRouteDeps> & { role?: string | null; userId?: string | null } = {}
): AdminPropertyRequestRouteDeps {
  const role = overrides.role ?? "admin";
  const userId = overrides.userId === undefined ? "admin-1" : overrides.userId;
  return {
    hasServerSupabaseEnv: () => true,
    getServerAuthUser: async () => ({
      supabase: createProfileSupabase(role),
      user: userId ? ({ id: userId } as User) : null,
    }),
    hasServiceRoleEnv: () => false,
    createServiceRoleClient: (() => createProfileSupabase(role)) as AdminPropertyRequestRouteDeps["createServiceRoleClient"],
    loadRequest: async () => ({ data: requestRow, error: null }),
    updateRequest: async () => ({ data: { ...requestRow, status: "closed" }, error: null }),
    now: () => "2026-03-16T16:00:00.000Z",
    ...overrides,
  };
}

void test("admin property request route rejects unauthenticated users", async () => {
  const response = await patchAdminPropertyRequestResponse(
    makePatchRequest({ action: "close" }),
    "req-1",
    buildDeps({ userId: null })
  );
  assert.equal(response.status, 401);
});

void test("admin property request route rejects non-admin users", async () => {
  const response = await patchAdminPropertyRequestResponse(
    makePatchRequest({ action: "close" }),
    "req-1",
    buildDeps({ role: "tenant" })
  );
  assert.equal(response.status, 403);
});

void test("admin property request route applies expire action and sets expiry timestamp", async () => {
  let updates: Record<string, unknown> | null = null;
  const response = await patchAdminPropertyRequestResponse(
    makePatchRequest({ action: "expire" }),
    "req-1",
    buildDeps({
      updateRequest: async ({ updates: nextUpdates }) => {
        updates = nextUpdates;
        return {
          data: { ...requestRow, status: "expired", expires_at: String(nextUpdates.expires_at ?? null) },
          error: null,
        };
      },
    })
  );
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.item.status, "expired");
  assert.deepEqual(updates, {
    status: "expired",
    expires_at: "2026-03-16T16:00:00.000Z",
  });
});

void test("admin property request route blocks non-remove actions once request is removed", async () => {
  const response = await patchAdminPropertyRequestResponse(
    makePatchRequest({ action: "close" }),
    "req-1",
    buildDeps({
      loadRequest: async () => ({ data: { ...requestRow, status: "removed" }, error: null }),
    })
  );
  assert.equal(response.status, 409);
});
