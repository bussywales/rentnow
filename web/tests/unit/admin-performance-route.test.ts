import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { buildSummaryByProperty } from "@/lib/analytics/property-events.server";
import {
  getAdminPropertyPerformanceResponse,
  type AdminPerformanceDeps,
} from "@/app/api/admin/properties/[id]/performance/route";

const makeRequest = (range?: number) =>
  new NextRequest(
    `http://localhost/api/admin/properties/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa/performance${
      range ? `?range=${range}` : ""
    }`,
    { method: "GET" }
  );

type PropertyRow = {
  id: string;
  created_at?: string | null;
  approved_at?: string | null;
  updated_at?: string | null;
};

const buildSupabaseStub = (row: PropertyRow) => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: row }),
      }),
    }),
  }),
});

void test("admin performance endpoint returns metrics", async () => {
  const propertyId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
  const now = new Date("2026-02-04T12:00:00Z");
  const property: PropertyRow = {
    id: propertyId,
    approved_at: "2026-02-01T00:00:00Z",
  };
  const supabase = buildSupabaseStub(property) as ReturnType<
    AdminPerformanceDeps["createServerSupabaseClient"]
  >;

  const deps: AdminPerformanceDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () => supabase,
    createServiceRoleClient: () =>
      ({} as ReturnType<AdminPerformanceDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        supabase,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminPerformanceDeps["requireRole"]>>,
    logFailure: () => undefined,
    fetchPropertyEvents: async () => ({
      rows: [
        {
          property_id: propertyId,
          event_type: "property_view",
          occurred_at: "2026-02-03T08:00:00Z",
          session_key: "s1",
        },
        {
          property_id: propertyId,
          event_type: "property_view",
          occurred_at: "2026-02-03T09:00:00Z",
          session_key: "s2",
        },
        {
          property_id: propertyId,
          event_type: "save_toggle",
          occurred_at: "2026-02-03T10:00:00Z",
          meta: { action: "save" },
        },
        {
          property_id: propertyId,
          event_type: "lead_created",
          occurred_at: "2026-02-03T11:00:00Z",
        },
        {
          property_id: propertyId,
          event_type: "viewing_requested",
          occurred_at: "2026-02-03T12:00:00Z",
        },
      ],
      error: null,
    }),
    buildSummaryByProperty,
    now: () => now,
  };

  const res = await getAdminPropertyPerformanceResponse(makeRequest(), propertyId, deps);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.views, 2);
  assert.equal(json.saves, 1);
  assert.equal(json.enquiries, 2);
  assert.equal(json.lead_rate, 1);
  assert.equal(json.days_live, 4);
  const seriesRow = (json.series || []).find((row: { date: string }) => row.date === "2026-02-03");
  assert.equal(seriesRow?.views, 2);
});

void test("invalid id returns 400", async () => {
  const deps: AdminPerformanceDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () =>
      ({} as ReturnType<AdminPerformanceDeps["createServerSupabaseClient"]>),
    createServiceRoleClient: () =>
      ({} as ReturnType<AdminPerformanceDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: true,
        supabase: {} as ReturnType<AdminPerformanceDeps["createServerSupabaseClient"]>,
        user: { id: "admin-1" } as User,
        role: "admin",
      }) as Awaited<ReturnType<AdminPerformanceDeps["requireRole"]>>,
    logFailure: () => undefined,
    fetchPropertyEvents: async () => ({ rows: [], error: null }),
    buildSummaryByProperty,
  };

  const res = await getAdminPropertyPerformanceResponse(
    makeRequest(),
    "not-a-uuid",
    deps
  );
  assert.equal(res.status, 400);
});

void test("non-admin is blocked", async () => {
  const deps: AdminPerformanceDeps = {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => false,
    createServerSupabaseClient: async () =>
      ({} as ReturnType<AdminPerformanceDeps["createServerSupabaseClient"]>),
    createServiceRoleClient: () =>
      ({} as ReturnType<AdminPerformanceDeps["createServiceRoleClient"]>),
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<AdminPerformanceDeps["requireRole"]>>,
    logFailure: () => undefined,
    fetchPropertyEvents: async () => ({ rows: [], error: null }),
    buildSummaryByProperty,
  };

  const res = await getAdminPropertyPerformanceResponse(
    makeRequest(),
    "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
    deps
  );
  assert.equal(res.status, 403);
});
