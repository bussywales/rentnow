import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import {
  getPropertyRequestExtendResponse,
  type PropertyRequestExtendRouteDeps,
} from "@/app/requests/[id]/extend/route";
import type { PropertyRequestRecord } from "@/lib/requests/property-requests";

function makeRequest() {
  return new NextRequest("http://localhost/requests/req-1/extend", { method: "GET" });
}

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
  move_timeline: "within_30_days",
  shortlet_duration: null,
  notes: null,
  status: "open",
  published_at: "2026-03-01T10:00:00.000Z",
  expires_at: "2026-03-31T10:00:00.000Z",
  extension_count: 0,
  last_expiry_reminder_for_expires_at: null,
  created_at: "2026-03-01T10:00:00.000Z",
  updated_at: "2026-03-01T10:00:00.000Z",
};

function buildSupabase(input: { row?: PropertyRequestRecord | null; updateError?: { message: string } | null } = {}) {
  let updatePayload: Record<string, unknown> | null = null;
  const row = input.row ?? openRow;
  return {
    capture: {
      get updatePayload() {
        return updatePayload;
      },
    },
    client: {
      from(table: string) {
        assert.equal(table, "property_requests");
        return {
          select() {
            return {
              eq() {
                return this;
              },
              maybeSingle: async () => ({ data: row, error: null }),
            };
          },
          update(values: Record<string, unknown>) {
            updatePayload = values;
            return {
              eq() {
                return this;
              },
              then: undefined,
            } as never;
          },
        };
      },
    },
  };
}

function buildDeps(input: Partial<PropertyRequestExtendRouteDeps> & { role?: string | null; userId?: string } = {}) {
  const supabase = buildSupabase();
  return {
    deps: {
      hasServerSupabaseEnv: () => true,
      createServerSupabaseClient: async () => supabase.client as never,
      requireUser: async () =>
        ({ ok: true, user: { id: input.userId ?? "tenant-1" } as User, supabase: supabase.client as never }) as Awaited<ReturnType<PropertyRequestExtendRouteDeps["requireUser"]>>,
      getUserRole: async () => (input.role === undefined ? "tenant" : input.role),
      now: () => new Date("2026-03-28T12:00:00.000Z"),
      ...input,
    } satisfies PropertyRequestExtendRouteDeps,
    capture: supabase.capture,
  };
}

void test("extend route redirects unauthenticated users into auth with continue", async () => {
  const { deps } = buildDeps({
    requireUser: async () => ({ ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }),
  });

  const response = await getPropertyRequestExtendResponse(makeRequest(), { params: Promise.resolve({ id: "req-1" }) }, deps);

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/auth/login?reason=auth&redirect=%2Frequests%2Freq-1%2Fextend");
});

void test("extend route rejects non-tenant roles", async () => {
  const { deps } = buildDeps({ role: "agent" });
  const response = await getPropertyRequestExtendResponse(makeRequest(), { params: Promise.resolve({ id: "req-1" }) }, deps);

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/forbidden");
});

void test("extend route updates expiry and extension count for eligible owner requests", async () => {
  const { deps, capture } = buildDeps();
  const response = await getPropertyRequestExtendResponse(makeRequest(), { params: Promise.resolve({ id: "req-1" }) }, deps);

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/requests/req-1?extend=success");
  assert.deepEqual(capture.updatePayload, {
    expires_at: "2026-04-30T10:00:00.000Z",
    extension_count: 1,
  });
});

void test("extend route rejects requests outside the extension window", async () => {
  const supabase = buildSupabase({ row: { ...openRow, expires_at: "2026-04-20T10:00:00.000Z" } });
  const deps: PropertyRequestExtendRouteDeps = {
    hasServerSupabaseEnv: () => true,
    createServerSupabaseClient: async () => supabase.client as never,
    requireUser: async () => ({ ok: true, user: { id: "tenant-1" } as User, supabase: supabase.client as never }) as Awaited<ReturnType<PropertyRequestExtendRouteDeps["requireUser"]>>,
    getUserRole: async () => "tenant",
    now: () => new Date("2026-03-28T12:00:00.000Z"),
  };

  const response = await getPropertyRequestExtendResponse(makeRequest(), { params: Promise.resolve({ id: "req-1" }) }, deps);

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/requests/req-1?extend=unavailable");
});
