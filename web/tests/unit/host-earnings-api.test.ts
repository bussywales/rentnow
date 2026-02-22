import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import { buildHostEarningsTimeline } from "@/lib/shortlet/host-earnings";
import {
  getHostShortletEarningsResponse,
  type HostShortletEarningsRouteDeps,
} from "../../app/api/host/shortlets/earnings/route";

const makeRequest = (url = "http://localhost/api/host/shortlets/earnings") =>
  new NextRequest(url, { method: "GET" });

void test("host earnings route uses delegated owner scope for agent acting-as sessions", async () => {
  let resolvedHostUserId: string | null = null;
  const deps: HostShortletEarningsRouteDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        user: { id: "agent-1" } as never,
        role: "agent",
        supabase: {} as never,
      }) as Awaited<ReturnType<HostShortletEarningsRouteDeps["requireRole"]>>,
    readActingAsFromRequest: () => "host-2",
    hasActiveDelegation: async () => true,
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => ({}) as never,
    listHostShortletEarningsTimeline: async (input) => {
      resolvedHostUserId = input.hostUserId;
      return {
        summary: {
          pendingApprovalCount: 0,
          upcomingCount: 0,
          inProgressCount: 0,
          completedUnpaidCount: 0,
          paidCount: 0,
          grossEarningsMinor: 0,
          paidOutMinor: 0,
          availableToPayoutMinor: 0,
        },
        items: [],
      };
    },
  };

  const response = await getHostShortletEarningsResponse(makeRequest(), deps);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(resolvedHostUserId, "host-2");
  assert.equal(body.summary.availableToPayoutMinor, 0);
});

void test("host earnings route preserves auth failures", async () => {
  const deps: HostShortletEarningsRouteDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }) as Awaited<ReturnType<HostShortletEarningsRouteDeps["requireRole"]>>,
    readActingAsFromRequest: () => null,
    hasActiveDelegation: async () => false,
    listHostShortletEarningsTimeline: async () => ({
      summary: {
        pendingApprovalCount: 0,
        upcomingCount: 0,
        inProgressCount: 0,
        completedUnpaidCount: 0,
        paidCount: 0,
        grossEarningsMinor: 0,
        paidOutMinor: 0,
        availableToPayoutMinor: 0,
      },
      items: [],
    }),
  };

  const response = await getHostShortletEarningsResponse(makeRequest(), deps);
  assert.equal(response.status, 401);
});

void test("host earnings timeline maps payout eligibility and reasons", () => {
  const timeline = buildHostEarningsTimeline({
    now: new Date("2026-02-22T10:00:00.000Z"),
    bookings: [
      {
        bookingId: "booking-pending",
        propertyId: "property-1",
        title: "Lekki Loft",
        city: "Lagos",
        checkIn: "2026-02-28",
        checkOut: "2026-03-02",
        nights: 2,
        bookingStatus: "pending",
        totalMinor: 120_000_00,
        currency: "NGN",
        pricingSnapshot: {},
      },
      {
        bookingId: "booking-upcoming",
        propertyId: "property-2",
        title: "Ikoyi Stay",
        city: "Lagos",
        checkIn: "2026-02-24",
        checkOut: "2026-02-26",
        nights: 2,
        bookingStatus: "confirmed",
        totalMinor: 90_000_00,
        currency: "NGN",
        pricingSnapshot: {},
      },
      {
        bookingId: "booking-pending-payout",
        propertyId: "property-3",
        title: "Abuja Flat",
        city: "Abuja",
        checkIn: "2026-02-18",
        checkOut: "2026-02-20",
        nights: 2,
        bookingStatus: "completed",
        totalMinor: 150_000_00,
        currency: "NGN",
        pricingSnapshot: { platform_fee_minor: 10_000_00 },
      },
      {
        bookingId: "booking-paid",
        propertyId: "property-4",
        title: "VI Penthouse",
        city: "Lagos",
        checkIn: "2026-02-10",
        checkOut: "2026-02-12",
        nights: 2,
        bookingStatus: "completed",
        totalMinor: 210_000_00,
        currency: "NGN",
        pricingSnapshot: {},
      },
    ],
    payments: [
      { bookingId: "booking-upcoming", status: "succeeded" },
      { bookingId: "booking-pending-payout", status: "succeeded" },
      { bookingId: "booking-paid", status: "succeeded" },
    ],
    payouts: [
      {
        bookingId: "booking-paid",
        amountMinor: 210_000_00,
        status: "paid",
        paidAt: "2026-02-21T12:00:00.000Z",
        paidMethod: "bank_transfer",
        paidReference: "PO-001",
        requestedAt: "2026-02-20T12:00:00.000Z",
        requestedByUserId: "host-1",
        requestedMethod: "bank_transfer",
        requestedNote: "Send in cycle",
      },
    ],
  });

  const byBookingId = new Map(timeline.items.map((row) => [row.bookingId, row]));
  assert.equal(byBookingId.get("booking-pending")?.payoutStatus, "not_eligible");
  assert.equal(byBookingId.get("booking-pending")?.payoutReason, "Booking pending approval");
  assert.equal(byBookingId.get("booking-upcoming")?.payoutStatus, "not_eligible");
  assert.equal(byBookingId.get("booking-upcoming")?.payoutReason, "Stay not completed");
  assert.equal(byBookingId.get("booking-pending-payout")?.payoutStatus, "pending");
  assert.equal(byBookingId.get("booking-paid")?.payoutStatus, "paid");

  assert.equal(timeline.summary.pendingApprovalCount, 1);
  assert.equal(timeline.summary.upcomingCount, 1);
  assert.equal(timeline.summary.completedUnpaidCount, 1);
  assert.equal(timeline.summary.paidCount, 1);
  assert.ok(timeline.summary.availableToPayoutMinor > 0);
});
