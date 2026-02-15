import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  getShortletMineBookingDetailResponse,
  type ShortletMineBookingDetailDeps,
} from "../../app/api/shortlet/bookings/[id]/mine/route";

const makeRequest = () =>
  new NextRequest("http://localhost/api/shortlet/bookings/booking-1/mine", {
    method: "GET",
  });

void test("shortlet booking detail route returns 404 for non-owner booking", async () => {
  const deps: ShortletMineBookingDetailDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        user: { id: "tenant-1" } as never,
        role: "tenant",
        supabase: {} as never,
      }) as Awaited<ReturnType<ShortletMineBookingDetailDeps["requireRole"]>>,
    getGuestShortletBookingById: async () => null,
  };

  const response = await getShortletMineBookingDetailResponse(
    makeRequest(),
    { params: Promise.resolve({ id: "booking-1" }) },
    deps
  );

  assert.equal(response.status, 404);
});

void test("shortlet booking detail route returns booking for owner", async () => {
  const deps: ShortletMineBookingDetailDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        user: { id: "tenant-1" } as never,
        role: "tenant",
        supabase: {} as never,
      }) as Awaited<ReturnType<ShortletMineBookingDetailDeps["requireRole"]>>,
    getGuestShortletBookingById: async () => ({
      id: "booking-1",
      property_id: "property-1",
      property_title: "Lekki suite",
      city: "Lagos",
      host_user_id: "host-1",
      host_name: "Host Team",
      check_in: "2026-03-20",
      check_out: "2026-03-23",
      nights: 3,
      status: "pending",
      total_amount_minor: 250000,
      currency: "NGN",
      expires_at: null,
      created_at: "2026-03-10T00:00:00.000Z",
      updated_at: "2026-03-10T00:00:00.000Z",
      payment_reference: null,
      pricing_snapshot_json: {},
    }),
  };

  const response = await getShortletMineBookingDetailResponse(
    makeRequest(),
    { params: Promise.resolve({ id: "booking-1" }) },
    deps
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.booking?.id, "booking-1");
});

void test("shortlet booking detail route blocks non-tenant roles", async () => {
  const deps: ShortletMineBookingDetailDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        user: { id: "host-1" } as never,
        role: "landlord",
        supabase: {} as never,
      }) as Awaited<ReturnType<ShortletMineBookingDetailDeps["requireRole"]>>,
    getGuestShortletBookingById: async () => null,
  };

  const response = await getShortletMineBookingDetailResponse(
    makeRequest(),
    { params: Promise.resolve({ id: "booking-1" }) },
    deps
  );

  assert.equal(response.status, 403);
});

void test("shortlet booking detail route preserves auth failures", async () => {
  const deps: ShortletMineBookingDetailDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }) as Awaited<ReturnType<ShortletMineBookingDetailDeps["requireRole"]>>,
    getGuestShortletBookingById: async () => null,
  };

  const response = await getShortletMineBookingDetailResponse(
    makeRequest(),
    { params: Promise.resolve({ id: "booking-1" }) },
    deps
  );

  assert.equal(response.status, 401);
});
