import test from "node:test";
import assert from "node:assert/strict";
import {
  assertPreferredTimesInAvailability,
  generateSlotsForDate,
} from "@/lib/availability/slots";

void test("generateSlotsForDate respects rules and timezone (Europe/London)", () => {
  const { slots, windows } = generateSlotsForDate({
    date: "2026-06-15", // Monday
    timeZone: "Europe/London",
    rules: [{ day_of_week: 1, start_minute: 9 * 60, end_minute: 11 * 60 }],
    exceptions: [],
    slotMinutes: 30,
  });
  assert.equal(windows.length, 1);
  assert.ok(slots.length > 0);
  const first = slots[0];
  assert.ok(first.local.startsWith("09"));
});

void test("generateSlotsForDate applies blackout and add_window exceptions", () => {
  const result = generateSlotsForDate({
    date: "2026-06-15",
    timeZone: "Europe/London",
    rules: [{ day_of_week: 1, start_minute: 9 * 60, end_minute: 12 * 60 }],
    exceptions: [
      { local_date: "2026-06-15", exception_type: "blackout", start_minute: 9 * 60, end_minute: 10 * 60 },
      { local_date: "2026-06-15", exception_type: "add_window", start_minute: 14 * 60, end_minute: 15 * 60 },
    ],
    slotMinutes: 60,
  });
  const locals = result.slots.map((s) => s.local);
  assert.ok(!locals.includes("09:00"), "blackout removed 09:00");
  assert.ok(locals.includes("10:00"), "remaining window retained 10:00");
  assert.ok(locals.includes("14:00"), "add_window added afternoon slot");
});

void test("assertPreferredTimesInAvailability rejects slots outside windows", () => {
  assert.throws(
    () =>
      assertPreferredTimesInAvailability({
        preferredTimes: ["2026-06-15T07:00:00Z"],
        timeZone: "Europe/London",
        rules: [{ day_of_week: 1, start_minute: 12 * 60, end_minute: 13 * 60 }],
        exceptions: [],
      }),
    /not available/,
    "should reject slot not matching generated availability"
  );
});
