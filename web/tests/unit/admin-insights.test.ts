import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePercent, calculateRate, resolveInsightsRange } from "@/lib/admin/insights";

void test("resolveInsightsRange defaults to 7d", () => {
  const range = resolveInsightsRange();
  assert.equal(range.key, "7d");
  assert.equal(range.days, 7);
});

void test("resolveInsightsRange accepts 90d", () => {
  const range = resolveInsightsRange("90d");
  assert.equal(range.key, "90d");
  assert.equal(range.days, 90);
});

void test("calculateRate returns null on zero denominator", () => {
  assert.equal(calculateRate(10, 0), null);
});

void test("calculatePercent clamps to integer percent", () => {
  assert.equal(calculatePercent(25, 200), 13);
});
