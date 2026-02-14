import test from "node:test";
import assert from "node:assert/strict";
import { calculateNights, calculateShortletPricing, hasDateOverlap } from "@/lib/shortlet/pricing";
import { resolveHostBookingResponseStatus } from "@/lib/shortlet/bookings";
import { mapLegacyListingIntent } from "@/lib/shortlet/shortlet.server";

void test("shortlet pricing computes nights and totals", () => {
  const breakdown = calculateShortletPricing({
    checkIn: "2026-02-20",
    checkOut: "2026-02-24",
    nightlyPriceMinor: 250000,
    cleaningFeeMinor: 30000,
    depositMinor: 50000,
  });

  assert.equal(breakdown.nights, 4);
  assert.equal(breakdown.subtotalMinor, 1000000);
  assert.equal(breakdown.totalAmountMinor, 1080000);
});

void test("calculateNights rejects invalid ranges", () => {
  assert.throws(() => calculateNights("2026-02-24", "2026-02-24"), /INVALID_NIGHTS/);
});

void test("overlap helper detects half-open date range conflicts", () => {
  assert.equal(
    hasDateOverlap(
      { from: "2026-02-20", to: "2026-02-25" },
      { from: "2026-02-24", to: "2026-02-27" }
    ),
    true
  );
  assert.equal(
    hasDateOverlap(
      { from: "2026-02-20", to: "2026-02-25" },
      { from: "2026-02-25", to: "2026-02-28" }
    ),
    false
  );
});

void test("booking status transitions only allow pending host responses", () => {
  assert.equal(resolveHostBookingResponseStatus("pending", "accept"), "confirmed");
  assert.equal(resolveHostBookingResponseStatus("pending", "decline"), "declined");
  assert.throws(
    () => resolveHostBookingResponseStatus("confirmed", "accept"),
    /INVALID_STATUS_TRANSITION/
  );
});

void test("intent migration mapping keeps compatibility", () => {
  assert.equal(mapLegacyListingIntent("rent"), "rent_lease");
  assert.equal(mapLegacyListingIntent("rent_lease"), "rent_lease");
  assert.equal(mapLegacyListingIntent("buy"), "sale");
  assert.equal(mapLegacyListingIntent("sale"), "sale");
  assert.equal(mapLegacyListingIntent("shortlet"), "shortlet");
  assert.equal(mapLegacyListingIntent("off_plan"), "off_plan");
});

