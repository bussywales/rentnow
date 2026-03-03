import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  PAGER_LITE_AXIS_THRESHOLD_PX,
  resolvePagerLiteAxis,
  resolvePagerLiteRelease,
  resolvePagerLiteSlots,
} from "@/components/explore/PagerLite";

void test("pager lite axis resolver waits for threshold and identifies dominant axis", () => {
  assert.equal(resolvePagerLiteAxis(4, 5), null);
  assert.equal(resolvePagerLiteAxis(18, 7), "horizontal");
  assert.equal(resolvePagerLiteAxis(7, 18), "vertical");
  assert.equal(PAGER_LITE_AXIS_THRESHOLD_PX, 10);
});

void test("pager lite keeps a fixed 3-slot buffer", () => {
  const slots = resolvePagerLiteSlots(2, 8);
  assert.equal(slots.length, 3);
  assert.deepEqual(
    slots.map((slot) => slot.name),
    ["prev", "current", "next"]
  );
  assert.deepEqual(
    slots.map((slot) => slot.index),
    [1, 2, 3]
  );
});

void test("pager lite release resolver advances by distance and clamps bounds", () => {
  assert.equal(
    resolvePagerLiteRelease({
      activeIndex: 0,
      totalSlides: 3,
      deltaY: -220,
      velocityY: -0.1,
      viewportHeight: 780,
    }),
    1
  );
  assert.equal(
    resolvePagerLiteRelease({
      activeIndex: 2,
      totalSlides: 3,
      deltaY: -220,
      velocityY: -0.1,
      viewportHeight: 780,
    }),
    2
  );
});

void test("pager lite source ignores gestures that start inside carousel shell", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "PagerLite.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /PAGER_LITE_CAROUSEL_SELECTOR/);
  assert.match(source, /explore-gallery-gesture-layer/);
  assert.match(source, /next\.startedInsideCarousel = startedInsideCarousel/);
  assert.match(source, /if \(gesture\.startedInsideCarousel \|\| gesture\.axis !== "vertical"\)/);
  assert.match(source, /data-testid="explore-pager-lite-track"/);
  assert.match(source, /touchAction: "pan-y pinch-zoom"/);
});
