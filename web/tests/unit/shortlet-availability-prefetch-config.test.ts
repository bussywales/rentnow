import assert from "node:assert/strict";
import test from "node:test";
import { resolveShortletAvailabilityPrefetchConfig } from "@/lib/shortlet/availability-prefetch-config";

void test("availability prefetch config defaults preserve current behaviour", () => {
  const config = resolveShortletAvailabilityPrefetchConfig({});
  assert.equal(config.enabled, true);
  assert.deepEqual(config.immediateMonthOffsets, [0, 1]);
  assert.deepEqual(config.deferredMonthOffsets, [-2, -1, 2]);
  assert.equal(config.maxInflight, 2);
});

void test("availability prefetch config applies safe env overrides", () => {
  const config = resolveShortletAvailabilityPrefetchConfig({
    NEXT_PUBLIC_SHORTLET_PREFETCH_ENABLED: "false",
    NEXT_PUBLIC_SHORTLET_PREFETCH_MAX_INFLIGHT: "4",
    NEXT_PUBLIC_SHORTLET_PREFETCH_DEBOUNCE_MS: "240",
  });
  assert.equal(config.enabled, false);
  assert.equal(config.maxInflight, 4);
  assert.equal(config.debounceMs, 240);
});
