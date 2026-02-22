import test from "node:test";
import assert from "node:assert/strict";
import {
  filterUnsentReminderDispatches,
  resolveReminderDispatches,
  type ShortletReminderBookingCandidate,
} from "@/lib/shortlet/reminders.server";

function candidate(overrides: Partial<ShortletReminderBookingCandidate>): ShortletReminderBookingCandidate {
  return {
    bookingId: "booking-1",
    propertyId: "property-1",
    hostUserId: "host-1",
    guestUserId: "guest-1",
    propertyTitle: "Lekki Loft",
    city: "Lagos",
    checkIn: "2026-02-24",
    checkOut: "2026-02-26",
    nights: 2,
    amountMinor: 25000000,
    currency: "NGN",
    bookingStatus: "confirmed",
    ...overrides,
  };
}

void test("reminder windows select expected events", () => {
  const now = new Date("2026-02-22T15:10:00.000Z");
  const dispatches = resolveReminderDispatches({
    now,
    candidates: [candidate({ bookingId: "checkin-48h" })],
    latestPaymentStatusByBookingId: new Map([["checkin-48h", "succeeded"]]),
  });

  assert.deepEqual(
    dispatches.map((row) => row.eventKey),
    ["checkin_48h"]
  );
});

void test("idempotency filter removes already-sent dispatches on rerun", () => {
  const now = new Date("2026-02-22T15:10:00.000Z");
  const dispatches = resolveReminderDispatches({
    now,
    candidates: [
      candidate({ bookingId: "a" }),
      candidate({ bookingId: "b" }),
    ],
    latestPaymentStatusByBookingId: new Map([
      ["a", "succeeded"],
      ["b", "succeeded"],
    ]),
  });

  const firstRun = filterUnsentReminderDispatches(dispatches, new Set());
  assert.equal(firstRun.length, 2);

  const sentKeys = new Set(firstRun.map((row) => `${row.bookingId}:${row.eventKey}`));
  const secondRun = filterUnsentReminderDispatches(dispatches, sentKeys);
  assert.equal(secondRun.length, 0);
});

void test("recipient targeting includes host heads-up only on 24h event", () => {
  const now = new Date("2026-02-23T15:02:00.000Z");
  const dispatches = resolveReminderDispatches({
    now,
    candidates: [candidate({ bookingId: "x", checkIn: "2026-02-24" })],
    latestPaymentStatusByBookingId: new Map([["x", "succeeded"]]),
  });

  const checkin24h = dispatches.find((row) => row.eventKey === "checkin_24h");
  assert.ok(checkin24h);
  assert.equal(checkin24h.notifyGuest, true);
  assert.equal(checkin24h.notifyHost, true);

  const otherEvents = dispatches.filter((row) => row.eventKey !== "checkin_24h");
  assert.equal(otherEvents.every((row) => row.notifyHost === false), true);
});

void test("pending bookings are ignored when payment is not succeeded", () => {
  const now = new Date("2026-02-22T15:10:00.000Z");
  const dispatches = resolveReminderDispatches({
    now,
    candidates: [
      candidate({
        bookingId: "pending-no-payment",
        bookingStatus: "pending",
      }),
    ],
    latestPaymentStatusByBookingId: new Map([["pending-no-payment", "other"]]),
  });

  assert.equal(dispatches.length, 0);
});
