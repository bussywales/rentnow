import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  postHostShortletPayoutRequestResponse,
  type HostPayoutRequestRouteDeps,
} from "../../app/api/host/shortlets/payouts/request/route";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/host/shortlets/payouts/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createDeps(
  overrides?: Partial<HostPayoutRequestRouteDeps>
): HostPayoutRequestRouteDeps {
  return {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    requireRole: async () =>
      ({
        ok: true,
        role: "landlord",
        user: { id: "host-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<HostPayoutRequestRouteDeps["requireRole"]>>,
    readActingAsFromRequest: () => null,
    hasActiveDelegation: async () => false,
    loadPayoutByBooking: async () => ({
      payoutId: "payout-1",
      bookingId: "booking-1",
      hostUserId: "host-1",
      payoutStatus: "eligible",
      bookingStatus: "completed",
      checkOut: "2026-02-20",
    }),
    getLatestShortletPaymentStatusForBooking: async () => "succeeded",
    isBookingEligibleForPayout: () => true,
    loadExistingRequest: async () => null,
    insertRequestAudit: async () => {},
    ...overrides,
  };
}

void test("host payout request route creates request when eligible", async () => {
  let insertCalls = 0;
  const deps = createDeps({
    insertRequestAudit: async () => {
      insertCalls += 1;
    },
  });

  const response = await postHostShortletPayoutRequestResponse(
    makeRequest({ bookingId: "booking-1", payoutMethod: "bank_transfer", note: "Please pay this cycle" }),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.alreadyRequested, false);
  assert.equal(body.request.bookingId, "booking-1");
  assert.equal(body.request.payoutMethod, "bank_transfer");
  assert.equal(insertCalls, 1);
});

void test("host payout request route is idempotent for repeated requests", async () => {
  let insertCalls = 0;
  const deps = createDeps({
    loadExistingRequest: async () => ({
      id: "audit-1",
      actor_user_id: "host-1",
      created_at: "2026-02-22T12:00:00.000Z",
      meta: { payout_method: "bank_transfer" },
    }),
    insertRequestAudit: async () => {
      insertCalls += 1;
    },
  });

  const response = await postHostShortletPayoutRequestResponse(
    makeRequest({ bookingId: "booking-1" }),
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.alreadyRequested, true);
  assert.equal(insertCalls, 0);
});

void test("host payout request route preserves auth rejection", async () => {
  const deps = createDeps({
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }) as Awaited<ReturnType<HostPayoutRequestRouteDeps["requireRole"]>>,
  });

  const response = await postHostShortletPayoutRequestResponse(
    makeRequest({ bookingId: "booking-1" }),
    deps
  );

  assert.equal(response.status, 401);
});
