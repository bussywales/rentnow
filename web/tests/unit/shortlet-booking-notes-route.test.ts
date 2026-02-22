import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  getShortletBookingNoteResponse,
  postShortletBookingNoteResponse,
  type ShortletBookingNoteRouteDeps,
} from "../../app/api/shortlet/bookings/[id]/note/route";

function makeBooking() {
  return {
    id: "booking-1",
    property_id: "property-1",
    guest_user_id: "tenant-1",
    host_user_id: "host-1",
    status: "pending",
    check_in: "2026-03-10",
    check_out: "2026-03-12",
    nights: 2,
    total_amount_minor: 12000000,
    currency: "NGN",
    property_title: "Lekki Loft",
    city: "Lagos",
  };
}

void test("tenant can post a booking note and host notifications are triggered", async () => {
  let notificationCalled = false;
  let emailCalled = false;

  const deps: ShortletBookingNoteRouteDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        role: "tenant",
        user: { id: "tenant-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<ShortletBookingNoteRouteDeps["requireRole"]>>,
    hasActiveDelegation: async () => false,
    loadBooking: async () => makeBooking(),
    listNotes: async () => [],
    insertNote: async () => ({
      id: "note-1",
      booking_id: "booking-1",
      author_user_id: "tenant-1",
      role: "tenant",
      topic: "check_in",
      message: "I will arrive around 8pm.",
      created_at: "2026-03-01T10:00:00.000Z",
    }),
    createNotification: async () => {
      notificationCalled = true;
      return { inserted: true, duplicate: false };
    },
    notifyHostGuestNote: async () => {
      emailCalled = true;
    },
    resolveUserEmail: async () => "host@example.com",
  };

  const request = new NextRequest("http://localhost/api/shortlet/bookings/booking-1/note", {
    method: "POST",
    body: JSON.stringify({
      topic: "check_in",
      message: "I will arrive around 8pm.",
    }),
    headers: { "Content-Type": "application/json" },
  });

  const response = await postShortletBookingNoteResponse(
    request,
    { params: Promise.resolve({ id: "booking-1" }) },
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.note.topic, "check_in");
  assert.equal(notificationCalled, true);
  assert.equal(emailCalled, true);
});

void test("host can read booking notes for owned listings", async () => {
  const deps: ShortletBookingNoteRouteDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: true,
        role: "landlord",
        user: { id: "host-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<ShortletBookingNoteRouteDeps["requireRole"]>>,
    hasActiveDelegation: async () => false,
    loadBooking: async () => makeBooking(),
    listNotes: async () => [
      {
        id: "note-1",
        booking_id: "booking-1",
        author_user_id: "tenant-1",
        role: "tenant",
        topic: "question",
        message: "Can we check in a little later?",
        created_at: "2026-03-01T10:00:00.000Z",
      },
    ],
    insertNote: async () => {
      throw new Error("not used");
    },
    createNotification: async () => ({ inserted: true, duplicate: false }),
    notifyHostGuestNote: async () => {},
    resolveUserEmail: async () => null,
  };

  const request = new NextRequest("http://localhost/api/shortlet/bookings/booking-1/note", {
    method: "GET",
  });

  const response = await getShortletBookingNoteResponse(
    request,
    { params: Promise.resolve({ id: "booking-1" }) },
    deps
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(Array.isArray(body.notes), true);
  assert.equal(body.notes.length, 1);
});

void test("guest note route preserves auth rejection from requireRole", async () => {
  const deps: ShortletBookingNoteRouteDeps = {
    hasServerSupabaseEnv: () => true,
    requireRole: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }) as Awaited<ReturnType<ShortletBookingNoteRouteDeps["requireRole"]>>,
    hasActiveDelegation: async () => false,
    loadBooking: async () => null,
    listNotes: async () => [],
    insertNote: async () => {
      throw new Error("not used");
    },
    createNotification: async () => ({ inserted: true, duplicate: false }),
    notifyHostGuestNote: async () => {},
    resolveUserEmail: async () => null,
  };

  const response = await getShortletBookingNoteResponse(
    new NextRequest("http://localhost/api/shortlet/bookings/booking-1/note", { method: "GET" }),
    { params: Promise.resolve({ id: "booking-1" }) },
    deps
  );

  assert.equal(response.status, 401);
});
