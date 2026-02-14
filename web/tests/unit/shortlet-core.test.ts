import test from "node:test";
import assert from "node:assert/strict";
import { calculateNights, calculateShortletPricing, hasDateOverlap } from "@/lib/shortlet/pricing";
import {
  blocksAvailability,
  canCancelBooking,
  mapBookingCreateError,
  resolveHostBookingResponseStatus,
} from "@/lib/shortlet/bookings";
import { mapLegacyListingIntent } from "@/lib/shortlet/shortlet.server";
import { resolveMarkPaidTransition } from "@/lib/shortlet/payouts";
import {
  canHostManageShortletBooking,
  canViewTenantShortletBookings,
  classifyShortletBookingWindow,
} from "@/lib/shortlet/access";

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

void test("shortlet pricing requires nightly price from settings", () => {
  assert.throws(
    () =>
      calculateShortletPricing({
        checkIn: "2026-02-20",
        checkOut: "2026-02-24",
        nightlyPriceMinor: 0,
        cleaningFeeMinor: 0,
        depositMinor: 0,
      }),
    /NIGHTLY_PRICE_REQUIRED/
  );
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

void test("overlap errors map to 409 with friendly message", () => {
  const mapped = mapBookingCreateError(
    'conflicting key value violates exclusion constraint "shortlet_bookings_no_overlap"'
  );
  assert.equal(mapped.status, 409);
  assert.match(mapped.error, /dates are no longer available/i);
});

void test("nightly price errors remain booking-blocking", () => {
  const mapped = mapBookingCreateError("NIGHTLY_PRICE_REQUIRED");
  assert.equal(mapped.status, 409);
});

void test("cancelled bookings release availability", () => {
  assert.equal(blocksAvailability("pending"), true);
  assert.equal(blocksAvailability("confirmed"), true);
  assert.equal(blocksAvailability("cancelled"), false);
  assert.equal(canCancelBooking("confirmed"), true);
  assert.equal(canCancelBooking("cancelled"), false);
});

void test("payout marking transition is idempotent", () => {
  assert.equal(resolveMarkPaidTransition("eligible"), "mark_paid");
  assert.equal(resolveMarkPaidTransition("paid"), "already_paid");
  assert.equal(resolveMarkPaidTransition("unknown"), "blocked");
});

void test("intent migration mapping keeps compatibility", () => {
  assert.equal(mapLegacyListingIntent("rent"), "rent_lease");
  assert.equal(mapLegacyListingIntent("rent_lease"), "rent_lease");
  assert.equal(mapLegacyListingIntent("buy"), "sale");
  assert.equal(mapLegacyListingIntent("sale"), "sale");
  assert.equal(mapLegacyListingIntent("shortlet"), "shortlet");
  assert.equal(mapLegacyListingIntent("off_plan"), "off_plan");
});

void test("host booking permissions enforce owner/admin/delegated agent", () => {
  assert.equal(
    canHostManageShortletBooking({
      actorRole: "landlord",
      actorUserId: "host-1",
      hostUserId: "host-1",
    }),
    true
  );
  assert.equal(
    canHostManageShortletBooking({
      actorRole: "agent",
      actorUserId: "agent-1",
      hostUserId: "host-1",
      hasDelegation: false,
    }),
    false
  );
  assert.equal(
    canHostManageShortletBooking({
      actorRole: "agent",
      actorUserId: "agent-1",
      hostUserId: "host-1",
      hasDelegation: true,
    }),
    true
  );
  assert.equal(
    canHostManageShortletBooking({
      actorRole: "admin",
      actorUserId: "admin-1",
      hostUserId: "host-1",
    }),
    true
  );
});

void test("tenant-only booking view gating and booking buckets", () => {
  assert.equal(canViewTenantShortletBookings("tenant"), true);
  assert.equal(canViewTenantShortletBookings("landlord"), false);

  const now = new Date("2026-03-01T10:00:00.000Z");
  assert.equal(
    classifyShortletBookingWindow({
      status: "pending",
      checkIn: "2026-03-10",
      checkOut: "2026-03-12",
      now,
    }),
    "incoming"
  );
  assert.equal(
    classifyShortletBookingWindow({
      status: "confirmed",
      checkIn: "2026-03-10",
      checkOut: "2026-03-12",
      now,
    }),
    "upcoming"
  );
  assert.equal(
    classifyShortletBookingWindow({
      status: "cancelled",
      checkIn: "2026-02-10",
      checkOut: "2026-02-11",
      now,
    }),
    "past"
  );
});
