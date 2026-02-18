import test from "node:test";
import assert from "node:assert/strict";
import {
  applyShortletDraftRange,
  canContinueToPayment,
  clearShortletDateRangeState,
  closeShortletCalendarOverlay,
  deriveShortletDraftSelection,
  isShortletDateUnavailable,
  openShortletCalendarOverlay,
  resolveRangeHint,
} from "@/components/properties/ShortletBookingWidget";
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

void test("calendar overlay opens from date input and closes on dismiss", () => {
  const selectedRange = {
    from: new Date("2026-04-10T00:00:00.000Z"),
    to: new Date("2026-04-14T00:00:00.000Z"),
  };
  const opened = openShortletCalendarOverlay(selectedRange);
  assert.equal(opened.calendarOpen, true);
  assert.ok(opened.draftRange?.from);
  assert.ok(opened.draftRange?.to);

  const closed = closeShortletCalendarOverlay(opened.draftRange);
  assert.equal(closed.calendarOpen, false);
  assert.ok(closed.draftRange?.from);
  assert.ok(closed.draftRange?.to);
});

void test("apply dates commits a full date range", () => {
  const applied = applyShortletDraftRange({
    from: new Date("2026-05-02T00:00:00.000Z"),
    to: new Date("2026-05-07T00:00:00.000Z"),
  });
  assert.ok(applied);
  assert.equal(applied?.checkIn, "2026-05-02");
  assert.equal(applied?.checkOut, "2026-05-07");
});

void test("clear resets selected and draft dates", () => {
  assert.deepEqual(clearShortletDateRangeState(), {
    selectedRange: undefined,
    draftRange: undefined,
    checkIn: "",
    checkOut: "",
  });
});

void test("continue CTA stays disabled until a valid range is selected", () => {
  assert.equal(
    canContinueToPayment({
      hasNightlyPriceConfigured: true,
      hasPricing: false,
      isRangeValid: false,
      loading: false,
    }),
    false
  );
});

void test("unavailable date is treated as unselectable", () => {
  const disabledSet = new Set<string>(["2026-07-10"]);
  assert.equal(
    isShortletDateUnavailable({
      date: new Date("2026-07-10T00:00:00.000Z"),
      todayDateKey: "2026-07-01",
      disabledSet,
    }),
    true
  );
});

void test("past date is treated as unavailable even when not in disabled set", () => {
  assert.equal(
    isShortletDateUnavailable({
      date: new Date("2026-07-01T00:00:00.000Z"),
      todayDateKey: "2026-07-02",
      disabledSet: new Set<string>(),
    }),
    true
  );
});

void test("draft selection rejects disabled start date", () => {
  const disabledSet = new Set<string>(["2026-07-10"]);
  const derived = deriveShortletDraftSelection({
    next: {
      from: new Date("2026-07-10T00:00:00.000Z"),
      to: undefined,
    },
    todayDateKey: "2026-07-01",
    disabledSet,
    minNights: 1,
    maxNights: null,
  });

  assert.equal(derived.isValid, false);
  assert.equal(derived.draftRange, undefined);
});

void test("draft selection rejects disabled end date and keeps start only", () => {
  const disabledSet = new Set<string>(["2026-07-12"]);
  const derived = deriveShortletDraftSelection({
    next: {
      from: new Date("2026-07-11T00:00:00.000Z"),
      to: new Date("2026-07-12T00:00:00.000Z"),
    },
    todayDateKey: "2026-07-01",
    disabledSet,
    minNights: 1,
    maxNights: null,
  });

  assert.equal(derived.isValid, false);
  assert.ok(derived.draftRange?.from);
  assert.equal(derived.draftRange?.to, undefined);
});

void test("range selection cannot include an unavailable date", () => {
  const disabledSet = new Set<string>(["2026-07-12"]);
  const derived = deriveShortletDraftSelection({
    next: {
      from: new Date("2026-07-11T00:00:00.000Z"),
      to: new Date("2026-07-13T00:00:00.000Z"),
    },
    todayDateKey: "2026-07-01",
    disabledSet,
    minNights: 1,
    maxNights: null,
  });

  assert.equal(derived.isValid, false);
  assert.equal(derived.draftRange?.to, undefined);
});
