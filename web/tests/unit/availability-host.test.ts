import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRuleInput, normalizeExceptionInput } from "@/lib/availability/host";

void test("normalizeRuleInput rejects overlapping windows", () => {
  assert.throws(
    () =>
      normalizeRuleInput([
        { dayOfWeek: 1, windows: [{ start: "09:00", end: "11:00" }, { start: "10:30", end: "12:00" }] },
      ]),
    /overlap/
  );
});

void test("normalizeRuleInput enforces bounds", () => {
  assert.throws(
    () => normalizeRuleInput([{ dayOfWeek: 1, windows: [{ start: "05:00", end: "07:00" }] }]),
    /06:00/
  );
});

void test("normalizeExceptionInput handles blackout full-day and add_window", () => {
  const blackout = normalizeExceptionInput({
    propertyId: "11111111-1111-4111-8111-111111111111",
    date: "2026-06-15",
    type: "blackout",
  });
  assert.equal(blackout.length, 1);
  assert.equal(blackout[0].start_minute, null);

  const addWindow = normalizeExceptionInput({
    propertyId: "11111111-1111-4111-8111-111111111111",
    date: "2026-06-15",
    type: "add_window",
    windows: [{ start: "10:00", end: "12:00" }],
  });
  assert.equal(addWindow[0].start_minute, 600);
  assert.equal(addWindow[0].exception_type, "add_window");
});
