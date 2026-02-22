import test from "node:test";
import assert from "node:assert/strict";
import { buildHostAgendaFromRows } from "@/lib/shortlet/host-agenda.server";

void test("host agenda buckets today, tomorrow, and next 7 days by check-in date", () => {
  const agenda = buildHostAgendaFromRows({
    now: new Date("2026-02-22T10:00:00.000Z"),
    latestPaymentStatusByBookingId: new Map([
      ["b-pending-paid", "succeeded"],
    ]),
    bookings: [
      {
        id: "b-today",
        property_id: "p-1",
        guest_user_id: "guest-1111",
        check_in: "2026-02-22",
        check_out: "2026-02-24",
        status: "confirmed",
        property_title: "Lekki Loft",
        city: "Lagos",
        booking_mode: "instant",
      },
      {
        id: "b-tomorrow",
        property_id: "p-2",
        guest_user_id: "guest-2222",
        check_in: "2026-02-23",
        check_out: "2026-02-26",
        status: "confirmed",
        property_title: "Ikoyi Suite",
        city: "Lagos",
        booking_mode: "request",
      },
      {
        id: "b-next7",
        property_id: "p-3",
        guest_user_id: "guest-3333",
        check_in: "2026-02-26",
        check_out: "2026-02-28",
        status: "confirmed",
        property_title: "Abuja Flat",
        city: "Abuja",
        booking_mode: "request",
      },
      {
        id: "b-pending-paid",
        property_id: "p-4",
        guest_user_id: "guest-4444",
        check_in: "2026-02-25",
        check_out: "2026-02-27",
        status: "pending",
        property_title: "VI Apartment",
        city: "Lagos",
        booking_mode: "request",
      },
    ],
  });

  assert.deepEqual(agenda.today.map((row) => row.bookingId), ["b-today"]);
  assert.deepEqual(agenda.tomorrow.map((row) => row.bookingId), ["b-tomorrow"]);
  assert.deepEqual(agenda.next7Days.map((row) => row.bookingId), ["b-pending-paid", "b-next7"]);
});

void test("host agenda excludes pending bookings without succeeded payment", () => {
  const agenda = buildHostAgendaFromRows({
    now: new Date("2026-02-22T10:00:00.000Z"),
    latestPaymentStatusByBookingId: new Map([["pending-other", "other"]]),
    bookings: [
      {
        id: "pending-other",
        property_id: "p-1",
        guest_user_id: "guest-1111",
        check_in: "2026-02-22",
        check_out: "2026-02-24",
        status: "pending",
        property_title: "Lekki Loft",
        city: "Lagos",
        booking_mode: "request",
      },
      {
        id: "confirmed-1",
        property_id: "p-2",
        guest_user_id: "guest-2222",
        check_in: "2026-02-22",
        check_out: "2026-02-24",
        status: "confirmed",
        property_title: "Ikoyi Suite",
        city: "Lagos",
        booking_mode: "instant",
      },
    ],
  });

  assert.deepEqual(agenda.today.map((row) => row.bookingId), ["confirmed-1"]);
});
