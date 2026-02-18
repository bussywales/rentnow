import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAvailabilityConflictResponse,
  buildProviderUnavailableResponse,
  calculateBookingNightsFromDates,
  resolveBookingGuests,
  resolveBookingMode,
} from "@/app/api/shortlet/bookings/create/route";

void test("booking create provider-unavailable response returns 409 with code and reason", async () => {
  const response = buildProviderUnavailableResponse("both_providers_disabled");
  const payload = (await response.json()) as { error?: string; reason?: string };

  assert.equal(response.status, 409);
  assert.equal(payload.error, "SHORTLET_PAYMENT_PROVIDER_UNAVAILABLE");
  assert.equal(payload.reason, "both_providers_disabled");
});

void test("booking create nights derivation returns positive day diff", () => {
  assert.equal(calculateBookingNightsFromDates("2026-03-10", "2026-03-14"), 4);
  assert.equal(calculateBookingNightsFromDates("2026-03-10", "2026-03-10"), null);
  assert.equal(calculateBookingNightsFromDates("invalid", "2026-03-14"), null);
});

void test("booking create guest derivation defaults and validates bounds", () => {
  assert.equal(resolveBookingGuests(undefined), 1);
  assert.equal(resolveBookingGuests(null), 1);
  assert.equal(resolveBookingGuests("2"), 2);
  assert.equal(resolveBookingGuests(0), null);
  assert.equal(resolveBookingGuests(1.5), null);
});

void test("booking create mode derivation prefers payload then settings then request", () => {
  assert.equal(resolveBookingMode("instant", "request"), "instant");
  assert.equal(resolveBookingMode(undefined, "instant"), "instant");
  assert.equal(resolveBookingMode(undefined, "unknown"), "request");
});

void test("booking create availability conflict response returns code and conflicting dates", async () => {
  const response = buildAvailabilityConflictResponse({
    conflictingDates: ["2026-08-10", "2026-08-11"],
    conflictingRanges: [{ start: "2026-08-10", end: "2026-08-12", source: "booking" }],
  });
  const payload = (await response.json()) as {
    code?: string;
    conflicting_dates?: string[];
    conflicting_ranges?: Array<{ start: string; end: string }>;
  };

  assert.equal(response.status, 409);
  assert.equal(payload.code, "availability_conflict");
  assert.deepEqual(payload.conflicting_dates, ["2026-08-10", "2026-08-11"]);
  assert.equal(payload.conflicting_ranges?.[0]?.start, "2026-08-10");
});
