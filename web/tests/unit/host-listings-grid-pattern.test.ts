import test from "node:test";
import assert from "node:assert/strict";
import {
  getHostListingTileClass,
  getHostListingTilePattern,
} from "@/lib/host/listings-grid-pattern";

void test("host listings grid uses deterministic repeating tile pattern", () => {
  const actual = Array.from({ length: 12 }, (_, index) => getHostListingTilePattern(index));
  assert.deepEqual(actual, [
    "tall",
    "square",
    "square",
    "wide",
    "square",
    "tall",
    "tall",
    "square",
    "square",
    "wide",
    "square",
    "tall",
  ]);
});

void test("host listings grid maps each pattern to stable row/col classes", () => {
  assert.equal(getHostListingTileClass("tall"), "row-span-36 md:row-span-38");
  assert.equal(getHostListingTileClass("square"), "row-span-30 md:row-span-32");
  assert.equal(
    getHostListingTileClass("wide"),
    "row-span-30 md:col-span-2 md:row-span-32 xl:col-span-2"
  );
});
