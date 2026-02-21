import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShortletPrefetchOffsetBatches,
  resolveShortletAvailabilityPrefetchSchedule,
  scheduleShortletDeferredTask,
  shouldFetchShortletAvailabilityWindow,
} from "@/lib/shortlet/availability";

void test("prefetch schedule keeps immediate months first and defers interaction offsets", () => {
  const initial = resolveShortletAvailabilityPrefetchSchedule("initial", {
    enabled: true,
    immediateOffsets: [0, 1],
    deferredOffsets: [-1, 2],
  });
  assert.deepEqual(initial.immediateOffsets, [0, 1]);
  assert.deepEqual(initial.deferredOffsets, []);

  const interaction = resolveShortletAvailabilityPrefetchSchedule("interaction", {
    enabled: true,
    immediateOffsets: [0, 1],
    deferredOffsets: [-1, 2],
  });
  assert.deepEqual(interaction.immediateOffsets, [0, 1]);
  assert.deepEqual(interaction.deferredOffsets, [-1, 2]);
});

void test("prefetch schedule is a no-op when config is disabled", () => {
  const disabled = resolveShortletAvailabilityPrefetchSchedule("interaction", {
    enabled: false,
    immediateOffsets: [0, 1],
    deferredOffsets: [-1, 2],
  });
  assert.deepEqual(disabled, {
    immediateOffsets: [],
    deferredOffsets: [],
  });
});

void test("prefetch batching respects max in-flight requests", () => {
  const batches = buildShortletPrefetchOffsetBatches([0, 1, -1, 2], 2);
  assert.deepEqual(batches, [
    [0, 1],
    [-1, 2],
  ]);
});

void test("rapid month changes dedupe already loaded and in-flight window requests", () => {
  const loadedWindowKeys = new Set(["listing-1:2026-03"]);
  const inFlightWindowKeys = new Set(["listing-1:2026-04"]);
  assert.equal(
    shouldFetchShortletAvailabilityWindow({
      cacheKey: "listing-1:2026-03",
      loadedWindowKeys,
      inFlightWindowKeys,
    }),
    false
  );
  assert.equal(
    shouldFetchShortletAvailabilityWindow({
      cacheKey: "listing-1:2026-04",
      loadedWindowKeys,
      inFlightWindowKeys,
    }),
    false
  );
  assert.equal(
    shouldFetchShortletAvailabilityWindow({
      cacheKey: "listing-1:2026-05",
      loadedWindowKeys,
      inFlightWindowKeys,
    }),
    true
  );
});

void test("deferred prefetch executes only after scheduler callback runs", () => {
  const executionOrder: string[] = [];
  let deferredTask: (() => void) | null = null;

  executionOrder.push("immediate:0");
  executionOrder.push("immediate:1");

  const cancel = scheduleShortletDeferredTask(
    () => {
      executionOrder.push("deferred:-1");
      executionOrder.push("deferred:2");
    },
    (task) => {
      deferredTask = task;
      return () => {
        deferredTask = null;
      };
    }
  );

  assert.deepEqual(executionOrder, ["immediate:0", "immediate:1"]);
  assert.ok(deferredTask);

  deferredTask?.();
  assert.deepEqual(executionOrder, [
    "immediate:0",
    "immediate:1",
    "deferred:-1",
    "deferred:2",
  ]);

  cancel();
  assert.equal(deferredTask, null);
});
