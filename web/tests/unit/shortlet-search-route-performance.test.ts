import assert from "node:assert/strict";
import test from "node:test";
import {
  createShortletSearchDebugMetrics,
  resolveShortletSourceRowsLimit,
} from "@/lib/shortlet/search-route-performance";

void test("source rows limit scales with cursor offset and respects max cap", () => {
  const firstPage = resolveShortletSourceRowsLimit({
    offset: 0,
    limit: 40,
    maxRows: 600,
  });
  const deepPage = resolveShortletSourceRowsLimit({
    offset: 320,
    limit: 40,
    maxRows: 600,
  });
  const capped = resolveShortletSourceRowsLimit({
    offset: 900,
    limit: 80,
    maxRows: 600,
  });

  assert.equal(firstPage, 120);
  assert.equal(deepPage, 440);
  assert.equal(capped, 600);
});

void test("debug metrics are normalized to non-negative integers", () => {
  const metrics = createShortletSearchDebugMetrics({
    dbRowsFetched: 52.7,
    postFilterCount: 18.9,
    availabilityPruned: -4,
    profileLookupsCount: 11.4,
    finalCount: 17.2,
    durationMs: 43.8,
  });

  assert.deepEqual(metrics, {
    dbRowsFetched: 52,
    postFilterCount: 18,
    availabilityPruned: 0,
    profileLookupsCount: 11,
    finalCount: 17,
    durationMs: 43,
  });
});
