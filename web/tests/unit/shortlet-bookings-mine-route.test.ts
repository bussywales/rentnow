import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  getShortletMineBookingsResponse,
  type ShortletMineBookingsDeps,
} from "../../app/api/shortlet/bookings/mine/route";

const makeRequest = () =>
  new NextRequest("http://localhost/api/shortlet/bookings/mine", {
    method: "GET",
  });

void test("my shortlet bookings route blocks non-tenant roles", async () => {
  const deps: ShortletMineBookingsDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        user: { id: "user-1" } as never,
        role: "landlord",
        supabase: {} as never,
      }) as Awaited<ReturnType<ShortletMineBookingsDeps["requireRole"]>>,
    listGuestShortletBookings: async () => [],
  };

  const response = await getShortletMineBookingsResponse(makeRequest(), deps);
  assert.equal(response.status, 403);
});

void test("my shortlet bookings route returns rows for tenant role", async () => {
  let queriedGuestUserId: string | null = null;
  const deps: ShortletMineBookingsDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        user: { id: "tenant-1" } as never,
        role: "tenant",
        supabase: {} as never,
      }) as Awaited<ReturnType<ShortletMineBookingsDeps["requireRole"]>>,
    listGuestShortletBookings: async (input) => {
      queriedGuestUserId = input.guestUserId;
      return [
        {
          id: "booking-1",
          property_id: "property-1",
          property_title: "Lekki studio",
          city: "Lagos",
          host_user_id: "host-1",
          host_name: "Host Team",
          check_in: "2026-03-12",
          check_out: "2026-03-14",
          nights: 2,
          status: "pending",
          total_amount_minor: 150000,
          currency: "NGN",
          expires_at: null,
          created_at: "2026-03-01T00:00:00.000Z",
        },
      ];
    },
  };

  const response = await getShortletMineBookingsResponse(makeRequest(), deps);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(Array.isArray(body.bookings), true);
  assert.equal(body.bookings.length, 1);
  assert.equal(queriedGuestUserId, "tenant-1");
});

void test("my shortlet bookings route preserves auth failures", async () => {
  const deps: ShortletMineBookingsDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }) as Awaited<ReturnType<ShortletMineBookingsDeps["requireRole"]>>,
    listGuestShortletBookings: async () => [],
  };

  const response = await getShortletMineBookingsResponse(makeRequest(), deps);
  assert.equal(response.status, 401);
});
