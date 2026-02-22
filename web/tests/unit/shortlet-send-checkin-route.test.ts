import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  postShortletSendCheckinResponse,
  type ShortletSendCheckinDeps,
} from "../../app/api/shortlet/bookings/[id]/send-checkin/route";

function makeBooking(overrides?: Partial<{
  id: string;
  property_id: string;
  host_user_id: string;
  guest_user_id: string;
  status: string;
}>) {
  return {
    id: overrides?.id || "booking-1",
    property_id: overrides?.property_id || "property-1",
    host_user_id: overrides?.host_user_id || "host-1",
    guest_user_id: overrides?.guest_user_id || "guest-1",
    status: overrides?.status || "confirmed",
    check_in: "2026-03-10",
    check_out: "2026-03-12",
    nights: 2,
    total_amount_minor: 12000000,
    currency: "NGN",
    property_title: "Lekki Loft",
    city: "Lagos",
  };
}

function createDeps(overrides?: Partial<ShortletSendCheckinDeps>): ShortletSendCheckinDeps {
  return {
    hasServerSupabaseEnv: () => true,
    hasServiceRoleEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        role: "landlord",
        user: { id: "host-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<ShortletSendCheckinDeps["requireRole"]>>,
    hasActiveDelegation: async () => false,
    createServerSupabaseClient: async () => ({} as never),
    createServiceRoleClient: () => ({ auth: { admin: { getUserById: async () => ({ data: { user: { email: "guest@example.com" } } }) } } }) as never,
    loadBooking: async () => makeBooking(),
    getLatestShortletPaymentStatusForBooking: async () => "succeeded",
    loadCheckinSettings: async () => ({
      checkin_window_start: "14:00:00",
      checkin_window_end: "20:00:00",
      checkout_time: "11:00:00",
      access_method: "Lockbox",
      access_code_hint: "Code shared in app",
      parking_info: "Basement B1",
      wifi_info: "Router by TV stand",
      house_rules: "No parties",
    }),
    reserveManualShareEvent: async () => ({ duplicate: false }),
    resolveUserEmail: async () => "guest@example.com",
    sendEmail: async () => ({ ok: true }),
    createNotification: async () => ({ inserted: true, duplicate: false }),
    getSiteUrl: async () => "https://www.propatyhub.com",
    ...overrides,
  };
}

void test("send-checkin route enforces host ownership", async () => {
  const deps = createDeps({
    requireRole: async () =>
      ({
        ok: true,
        role: "landlord",
        user: { id: "host-2" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<ShortletSendCheckinDeps["requireRole"]>>,
    loadBooking: async () => makeBooking({ host_user_id: "host-1" }),
  });

  const response = await postShortletSendCheckinResponse(
    new NextRequest("http://localhost/api/shortlet/bookings/booking-1/send-checkin", { method: "POST" }),
    { params: Promise.resolve({ id: "booking-1" }) },
    deps
  );

  assert.equal(response.status, 403);
});

void test("send-checkin route blocks pending or unpaid bookings", async () => {
  const deps = createDeps({
    loadBooking: async () => makeBooking({ status: "pending" }),
    getLatestShortletPaymentStatusForBooking: async () => "pending",
  });

  const response = await postShortletSendCheckinResponse(
    new NextRequest("http://localhost/api/shortlet/bookings/booking-1/send-checkin", { method: "POST" }),
    { params: Promise.resolve({ id: "booking-1" }) },
    deps
  );

  assert.equal(response.status, 409);
});

void test("send-checkin route returns alreadySent for duplicate event reservation", async () => {
  let emailCalls = 0;
  const deps = createDeps({
    reserveManualShareEvent: async () => ({ duplicate: true }),
    sendEmail: async () => {
      emailCalls += 1;
      return { ok: true };
    },
  });

  const response = await postShortletSendCheckinResponse(
    new NextRequest("http://localhost/api/shortlet/bookings/booking-1/send-checkin", { method: "POST" }),
    { params: Promise.resolve({ id: "booking-1" }) },
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.alreadySent, true);
  assert.equal(emailCalls, 0);
});

void test("send-checkin route sends details for confirmed and paid booking", async () => {
  let emailCalls = 0;
  let notificationCalls = 0;
  const deps = createDeps({
    sendEmail: async () => {
      emailCalls += 1;
      return { ok: true };
    },
    createNotification: async () => {
      notificationCalls += 1;
      return { inserted: true, duplicate: false };
    },
  });

  const response = await postShortletSendCheckinResponse(
    new NextRequest("http://localhost/api/shortlet/bookings/booking-1/send-checkin", { method: "POST" }),
    { params: Promise.resolve({ id: "booking-1" }) },
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.alreadySent, false);
  assert.equal(emailCalls, 1);
  assert.equal(notificationCalls, 1);
});

void test("send-checkin route preserves requireRole auth response", async () => {
  const deps = createDeps({
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }) as Awaited<ReturnType<ShortletSendCheckinDeps["requireRole"]>>,
  });

  const response = await postShortletSendCheckinResponse(
    new NextRequest("http://localhost/api/shortlet/bookings/booking-1/send-checkin", { method: "POST" }),
    { params: Promise.resolve({ id: "booking-1" }) },
    deps
  );

  assert.equal(response.status, 401);
});
