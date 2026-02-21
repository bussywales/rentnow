import assert from "node:assert/strict";
import test from "node:test";
import {
  retainSelectedShortletMarkerId,
  shouldEnableShortletMapClustering,
} from "@/lib/shortlet/map-clustering";
import { SHORTLETS_CLUSTER_THRESHOLD } from "@/lib/shortlet/map-perf-config";

void test("clustering is enabled only at and above the marker threshold", () => {
  assert.equal(shouldEnableShortletMapClustering(0), false);
  assert.equal(shouldEnableShortletMapClustering(SHORTLETS_CLUSTER_THRESHOLD - 1), false);
  assert.equal(shouldEnableShortletMapClustering(SHORTLETS_CLUSTER_THRESHOLD), true);
  assert.equal(shouldEnableShortletMapClustering(SHORTLETS_CLUSTER_THRESHOLD + 24), true);
});

void test("clustering can be disabled with config override", () => {
  assert.equal(
    shouldEnableShortletMapClustering(200, {
      enabled: false,
      threshold: SHORTLETS_CLUSTER_THRESHOLD,
    }),
    false
  );
});

void test("selected marker id is retained across recalculations when still present", () => {
  const initial = retainSelectedShortletMarkerId({
    selectedListingId: "listing-42",
    markerIds: ["listing-12", "listing-42", "listing-99"],
  });
  assert.equal(initial, "listing-42");

  const afterRecalc = retainSelectedShortletMarkerId({
    selectedListingId: initial,
    markerIds: ["listing-42", "listing-100"],
  });
  assert.equal(afterRecalc, "listing-42");
});

void test("selected marker id clears when marker no longer exists", () => {
  const selected = retainSelectedShortletMarkerId({
    selectedListingId: "listing-42",
    markerIds: ["listing-10", "listing-11"],
  });
  assert.equal(selected, null);
});
