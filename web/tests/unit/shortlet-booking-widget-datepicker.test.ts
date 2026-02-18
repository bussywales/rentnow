import test from "node:test";
import assert from "node:assert/strict";
import { canContinueToPayment, resolveRangeHint } from "@/components/properties/ShortletBookingWidget";
import { isRangeValid } from "@/lib/shortlet/availability";

void test("resolveRangeHint returns unavailable copy for blocked ranges", () => {
  assert.equal(
    resolveRangeHint("includes_unavailable_night", { minNights: 1, maxNights: null }),
    "Those dates include unavailable nights. Choose different dates."
  );
});

void test("valid range enables continue CTA", () => {
  const disabled = new Set<string>(["2026-06-10"]);

  const valid = isRangeValid({
    checkIn: "2026-06-12",
    checkOut: "2026-06-15",
    disabledSet: disabled,
    minNights: 1,
    maxNights: null,
  });

  assert.equal(
    canContinueToPayment({
      hasNightlyPriceConfigured: true,
      hasPricing: true,
      isRangeValid: valid,
      loading: false,
    }),
    true
  );
});

void test("invalid range keeps continue CTA disabled", () => {
  const disabled = new Set<string>(["2026-06-13"]);

  const valid = isRangeValid({
    checkIn: "2026-06-12",
    checkOut: "2026-06-14",
    disabledSet: disabled,
    minNights: 1,
    maxNights: null,
  });

  assert.equal(valid, false);
  assert.equal(
    canContinueToPayment({
      hasNightlyPriceConfigured: true,
      hasPricing: true,
      isRangeValid: valid,
      loading: false,
    }),
    false
  );
});
