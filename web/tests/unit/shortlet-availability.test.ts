import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPrepBufferToUnavailableRanges,
  expandRangesToDisabledDates,
  isRangeValid,
  nextValidEndDate,
  resolveAvailabilityConflicts,
  validateRangeSelection,
} from "@/lib/shortlet/availability";

void test("expandRangesToDisabledDates expands blocked and booked windows into date keys", () => {
  const disabled = expandRangesToDisabledDates(
    [
      { start: "2026-03-10", end: "2026-03-12", source: "host_block" },
      { start: "2026-03-15", end: "2026-03-17", source: "booking" },
    ],
    "2026-03-01",
    "2026-03-31"
  );

  assert.deepEqual(Array.from(disabled).sort(), [
    "2026-03-10",
    "2026-03-11",
    "2026-03-15",
    "2026-03-16",
  ]);
});

void test("isRangeValid rejects ranges that overlap unavailable stayed nights", () => {
  const disabled = new Set<string>(["2026-03-11", "2026-03-15"]);

  assert.equal(
    isRangeValid({
      checkIn: "2026-03-10",
      checkOut: "2026-03-12",
      disabledSet: disabled,
      minNights: 1,
      maxNights: null,
    }),
    false
  );

  assert.equal(
    isRangeValid({
      checkIn: "2026-03-12",
      checkOut: "2026-03-14",
      disabledSet: disabled,
      minNights: 1,
      maxNights: null,
    }),
    true
  );
});

void test("checkout date can be unavailable while range remains valid", () => {
  const disabled = new Set<string>(["2026-03-15"]);
  const result = validateRangeSelection({
    checkIn: "2026-03-13",
    checkOut: "2026-03-15",
    disabledSet: disabled,
    minNights: 1,
    maxNights: null,
  });

  assert.equal(result.valid, true);
  assert.equal(result.reason, null);
  assert.equal(result.nights, 2);
});

void test("nextValidEndDate finds nearest end date respecting min/max nights and disabled nights", () => {
  const disabled = new Set<string>(["2026-04-04", "2026-04-05"]);

  assert.equal(
    nextValidEndDate({
      checkIn: "2026-04-03",
      disabledSet: disabled,
      minNights: 1,
      maxNights: 5,
      searchLimitDays: 10,
    }),
    "2026-04-04"
  );

  assert.equal(
    nextValidEndDate({
      checkIn: "2026-04-04",
      disabledSet: disabled,
      minNights: 1,
      maxNights: 5,
      searchLimitDays: 10,
    }),
    null
  );
});

void test("resolveAvailabilityConflicts flags overlap but allows back-to-back when checkout is exclusive", () => {
  const unavailable = [{ start: "2026-05-10", end: "2026-05-12", source: "booking" as const }];
  const overlap = resolveAvailabilityConflicts({
    checkIn: "2026-05-11",
    checkOut: "2026-05-13",
    unavailableRanges: unavailable,
    prepDays: 0,
  });
  assert.equal(overlap.hasConflict, true);
  assert.deepEqual(overlap.conflictingDates, ["2026-05-11"]);

  const backToBack = resolveAvailabilityConflicts({
    checkIn: "2026-05-12",
    checkOut: "2026-05-14",
    unavailableRanges: unavailable,
    prepDays: 0,
  });
  assert.equal(backToBack.hasConflict, false);
  assert.deepEqual(backToBack.conflictingDates, []);
});

void test("prep buffer extends booked end date and blocks immediate back-to-back when configured", () => {
  const unavailable = [{ start: "2026-07-10", end: "2026-07-12", source: "booking" as const }];
  const effective = applyPrepBufferToUnavailableRanges(unavailable, 1);
  assert.equal(effective[0]?.end, "2026-07-13");

  const withPrepConflict = resolveAvailabilityConflicts({
    checkIn: "2026-07-12",
    checkOut: "2026-07-14",
    unavailableRanges: unavailable,
    prepDays: 1,
  });
  assert.equal(withPrepConflict.hasConflict, true);
  assert.deepEqual(withPrepConflict.conflictingDates, ["2026-07-12"]);
});
