import test from "node:test";
import assert from "node:assert/strict";
import { matchesTripsFilter, resolveTripBucket } from "@/lib/shortlet/trips";

const now = new Date("2026-03-15T10:00:00.000Z");

void test("trip bucket resolves pending first", () => {
  assert.equal(
    resolveTripBucket({
      status: "pending",
      checkIn: "2026-03-20",
      checkOut: "2026-03-23",
      now,
    }),
    "pending"
  );
});

void test("trip bucket resolves confirmed future bookings as upcoming", () => {
  assert.equal(
    resolveTripBucket({
      status: "confirmed",
      checkIn: "2026-03-20",
      checkOut: "2026-03-23",
      now,
    }),
    "upcoming"
  );
});

void test("trip bucket resolves confirmed past bookings as past", () => {
  assert.equal(
    resolveTripBucket({
      status: "confirmed",
      checkIn: "2026-03-10",
      checkOut: "2026-03-12",
      now,
    }),
    "past"
  );
});

void test("trip bucket resolves cancelled-like statuses", () => {
  assert.equal(
    resolveTripBucket({
      status: "cancelled",
      checkIn: "2026-03-20",
      checkOut: "2026-03-23",
      now,
    }),
    "cancelled"
  );
  assert.equal(
    resolveTripBucket({
      status: "declined",
      checkIn: "2026-03-20",
      checkOut: "2026-03-23",
      now,
    }),
    "cancelled"
  );
});

void test("matchesTripsFilter supports all and bucket filters", () => {
  assert.equal(
    matchesTripsFilter({
      status: "pending",
      checkIn: "2026-03-20",
      checkOut: "2026-03-23",
      filter: "all",
      now,
    }),
    true
  );

  assert.equal(
    matchesTripsFilter({
      status: "pending",
      checkIn: "2026-03-20",
      checkOut: "2026-03-23",
      filter: "pending",
      now,
    }),
    true
  );

  assert.equal(
    matchesTripsFilter({
      status: "pending",
      checkIn: "2026-03-20",
      checkOut: "2026-03-23",
      filter: "upcoming",
      now,
    }),
    false
  );
});
