import test from "node:test";
import assert from "node:assert/strict";

import {
  isConstrainedEffectiveType,
  isExploreV2PrefetchBlockedEffectiveType,
  readShouldConserveData,
  resolveExploreV2PrefetchLookahead,
  shouldConserveData,
  shouldDisableExploreV2Prefetch,
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

void test("network hints disables explore-v2 prefetch on saveData", () => {
  assert.equal(
    shouldDisableExploreV2Prefetch({
      saveData: true,
      effectiveType: "4g",
    }),
    true
  );
  assert.equal(
    resolveExploreV2PrefetchLookahead({
      connection: { saveData: true, effectiveType: "4g" },
      deviceMemory: 8,
    } as Navigator),
    0
  );
});

void test("network hints disables explore-v2 prefetch on slow-2g/2g only", () => {
  assert.equal(isExploreV2PrefetchBlockedEffectiveType("slow-2g"), true);
  assert.equal(isExploreV2PrefetchBlockedEffectiveType("2g"), true);
  assert.equal(isExploreV2PrefetchBlockedEffectiveType("3g"), false);
  assert.equal(
    resolveExploreV2PrefetchLookahead({
      connection: { effectiveType: "2g", saveData: false },
      deviceMemory: 8,
    } as Navigator),
    0
  );
  assert.equal(
    resolveExploreV2PrefetchLookahead({
      connection: { effectiveType: "3g", saveData: false },
      deviceMemory: 8,
    } as Navigator),
    2
  );
});

void test("network hints reduces explore-v2 prefetch lookahead on low memory", () => {
  assert.equal(
    resolveExploreV2PrefetchLookahead({
      connection: { effectiveType: "4g", saveData: false },
      deviceMemory: 2,
    } as Navigator),
    1
  );
  assert.equal(
    resolveExploreV2PrefetchLookahead({
      connection: { effectiveType: "4g", saveData: false },
      deviceMemory: 1,
    } as Navigator),
    0
  );
});
