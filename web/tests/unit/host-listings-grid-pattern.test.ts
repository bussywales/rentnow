import test from "node:test";
import assert from "node:assert/strict";
import {
  getHostListingTileAspectClass,
  getHostListingTilePattern,
} from "@/lib/host/listings-grid-pattern";

void test("host listings grid uses deterministic repeating tile pattern", () => {
  const actual = Array.from({ length: 12 }, (_, index) => getHostListingTilePattern(index));
  assert.deepEqual(actual, [
    "portrait",
    "portrait",
    "portrait",
    "portrait",
    "square",
    "portrait",
    "landscape",
    "portrait",
    "portrait",
    "square",
    "portrait",
    "portrait",
  ]);
});

void test("host listings grid maps patterns to stable editorial aspect classes", () => {
  assert.equal(getHostListingTileAspectClass("portrait"), "aspect-[4/5]");
  assert.equal(getHostListingTileAspectClass("square"), "aspect-square");
  assert.equal(getHostListingTileAspectClass("landscape"), "aspect-[16/9]");
});
