import test from "node:test";
import assert from "node:assert/strict";
import {
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
