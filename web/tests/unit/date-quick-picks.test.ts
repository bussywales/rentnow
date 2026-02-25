import test from "node:test";
import assert from "node:assert/strict";
import {
  getWeekendRange,
  isDateKey,
  resolveDateQuickPickRange,
} from "@/lib/search/date-quick-picks";

void test("getWeekendRange returns deterministic friday-to-sunday keys", () => {
  const range = getWeekendRange(new Date("2026-02-25T10:00:00.000Z"), 0);
  assert.deepEqual(range, {
    checkIn: "2026-02-27",
    checkOut: "2026-03-01",
  });
});

void test("getWeekendRange offset returns next-weekend range", () => {
  const range = getWeekendRange(new Date("2026-02-25T10:00:00.000Z"), 1);
  assert.deepEqual(range, {
    checkIn: "2026-03-06",
    checkOut: "2026-03-08",
  });
});

void test("resolveDateQuickPickRange maps quick picks and flexible clears", () => {
  const baseDate = new Date("2026-02-25T10:00:00.000Z");
  const thisWeekend = resolveDateQuickPickRange("this_weekend", baseDate);
  const nextWeekend = resolveDateQuickPickRange("next_weekend", baseDate);
  const flexible = resolveDateQuickPickRange("flexible", baseDate);

  assert.ok(thisWeekend);
  assert.ok(nextWeekend);
  assert.equal(flexible, null);
});

void test("isDateKey validates yyyy-mm-dd format", () => {
  assert.equal(isDateKey("2026-02-25"), true);
  assert.equal(isDateKey("2026/02/25"), false);
  assert.equal(isDateKey(""), false);
  assert.equal(isDateKey(undefined), false);
});
