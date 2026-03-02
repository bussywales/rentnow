import test from "node:test";
import assert from "node:assert/strict";

import {
  isConstrainedEffectiveType,
  readShouldConserveData,
  shouldConserveData,
} from "@/lib/explore/network-hints";

void test("network hints enables conserve mode when saveData is true", () => {
  assert.equal(
    shouldConserveData({
      saveData: true,
      effectiveType: "4g",
    }),
    true
  );
});

void test("network hints enables conserve mode for constrained effective types", () => {
  assert.equal(isConstrainedEffectiveType("slow-2g"), true);
  assert.equal(isConstrainedEffectiveType("2g"), true);
  assert.equal(isConstrainedEffectiveType("3g"), true);
  assert.equal(isConstrainedEffectiveType("4g"), false);
});

void test("network hints defaults to non-conserve mode when navigator.connection is unavailable", () => {
  assert.equal(readShouldConserveData(null), false);
  assert.equal(readShouldConserveData({} as Navigator), false);
});
