import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  getAdminShortletsOpsResponse,
  type AdminShortletsOpsDeps,
} from "@/app/api/admin/shortlets/ops/route";

function makeRequest() {
  return new NextRequest("http://localhost/api/admin/shortlets/ops", { method: "GET" });
}

void test("admin shortlets ops route preserves auth failures", async () => {
  const deps: AdminShortletsOpsDeps = {
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }) as Awaited<ReturnType<AdminShortletsOpsDeps["requireRole"]>>,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    getShortletsOpsSnapshot: async () => {
      throw new Error("Should not run");
    },
    now: () => new Date("2026-02-23T11:00:00.000Z"),
  };

  const response = await getAdminShortletsOpsResponse(makeRequest(), deps);
  assert.equal(response.status, 403);
});

void test("admin shortlets ops route returns complete payload keys", async () => {
  const deps: AdminShortletsOpsDeps = {
    requireRole: async () =>
      ({
        ok: true,
        role: "admin",
        user: { id: "admin-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<AdminShortletsOpsDeps["requireRole"]>>,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    getShortletsOpsSnapshot: async () => ({
      reminders: {
        lastRun: null,
        lastSuccess: null,
        lastFailure: null,
        recentRuns: [],
      },
      payouts: {
        requestedCount: 3,
        oldestRequestedAt: "2026-02-23T08:00:00.000Z",
        lastPaidAt: "2026-02-23T07:00:00.000Z",
        recentRequested: [],
      },
      mismatches: {
        stuckSucceededPaymentCount: 1,
        sample: [
          {
            bookingId: "booking-1",
            paymentId: "payment-1",
            paymentUpdatedAt: "2026-02-23T06:00:00.000Z",
            bookingCreatedAt: "2026-02-23T05:00:00.000Z",
          },
        ],
      },
      sla: {
        dueSoonCount: 2,
        overdueCount: 1,
        sample: [
          {
            bookingId: "booking-2",
            respondBy: "2026-02-23T12:00:00.000Z",
            createdAt: "2026-02-23T00:00:00.000Z",
            listingId: "property-1",
          },
        ],
      },
    }),
    now: () => new Date("2026-02-23T11:00:00.000Z"),
  };

  const response = await getAdminShortletsOpsResponse(makeRequest(), deps);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.route, "/api/admin/shortlets/ops");
  assert.equal(body.asOf, "2026-02-23");
  assert.ok("reminders" in body);
  assert.ok("payouts" in body);
  assert.ok("mismatches" in body);
  assert.ok("sla" in body);
});

void test("admin shortlets ops route returns empty reminders block without crashing", async () => {
  const deps: AdminShortletsOpsDeps = {
    requireRole: async () =>
      ({
        ok: true,
        role: "admin",
        user: { id: "admin-2" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<AdminShortletsOpsDeps["requireRole"]>>,
    hasServiceRoleEnv: () => false,
    createServiceRoleClient: () => ({}) as never,
    getShortletsOpsSnapshot: async () => ({
      reminders: {
        lastRun: null,
        lastSuccess: null,
        lastFailure: null,
        recentRuns: [],
      },
      payouts: {
        requestedCount: 0,
        oldestRequestedAt: null,
        lastPaidAt: null,
        recentRequested: [],
      },
      mismatches: {
        stuckSucceededPaymentCount: 0,
        sample: [],
      },
      sla: {
        dueSoonCount: 0,
        overdueCount: 0,
        sample: [],
      },
    }),
    now: () => new Date("2026-02-23T11:00:00.000Z"),
  };

  const response = await getAdminShortletsOpsResponse(makeRequest(), deps);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.reminders.lastRun, null);
  assert.equal(Array.isArray(body.reminders.recentRuns), true);
  assert.equal(body.reminders.recentRuns.length, 0);
});
