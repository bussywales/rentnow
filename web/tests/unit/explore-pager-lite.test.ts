import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  accumulatePagerLiteWheelDelta,
  PAGER_LITE_AXIS_THRESHOLD_PX,
  PAGER_LITE_WHEEL_THRESHOLD_PX,
  resolvePagerLiteAxis,
  resolvePagerLiteRelease,
  resolvePagerLiteSlots,
  resolvePagerLiteWheelDirectionFromAccumulatedDelta,
  shouldStartPagerLitePointerGesture,
  shouldThrottlePagerLiteWheelNavigation,
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
  assert.match(source, /if \(startedInsideCarousel\(event\.target\)\) return;/);
  assert.match(source, /if \(gesture\.startedInsideCarousel \|\| gesture\.axis !== "vertical"\)/);
  assert.match(source, /onWheelCapture=\{\(event\) => \{/);
  assert.match(source, /data-testid="explore-pager-lite-track"/);
  assert.match(source, /touchAction: "pan-y pinch-zoom"/);
});

void test("pager lite wheel accumulation advances only after threshold", () => {
  let accumulated = 0;
  accumulated = accumulatePagerLiteWheelDelta({ accumulatedDelta: accumulated, nextDelta: 24 });
  assert.equal(resolvePagerLiteWheelDirectionFromAccumulatedDelta(accumulated), null);

  accumulated = accumulatePagerLiteWheelDelta({
    accumulatedDelta: accumulated,
    nextDelta: PAGER_LITE_WHEEL_THRESHOLD_PX,
  });
  assert.equal(resolvePagerLiteWheelDirectionFromAccumulatedDelta(accumulated), "next");
});

void test("pager lite wheel cooldown blocks duplicate direction bursts", () => {
  assert.equal(
    shouldThrottlePagerLiteWheelNavigation({
      nowMs: 1000,
      lastTriggeredAtMs: 900,
      nextDirection: "next",
      lastDirection: "next",
    }),
    true
  );
  assert.equal(
    shouldThrottlePagerLiteWheelNavigation({
      nowMs: 1000,
      lastTriggeredAtMs: 900,
      nextDirection: "prev",
      lastDirection: "next",
    }),
    false
  );
});

void test("pager lite pointer guard allows only left-button non-touch drags outside gallery", () => {
  assert.equal(
    shouldStartPagerLitePointerGesture({
      pointerType: "mouse",
      button: 0,
      startedInsideCarousel: false,
    }),
    true
  );
  assert.equal(
    shouldStartPagerLitePointerGesture({
      pointerType: "mouse",
      button: 2,
      startedInsideCarousel: false,
    }),
    false
  );
  assert.equal(
    shouldStartPagerLitePointerGesture({
      pointerType: "touch",
      button: 0,
      startedInsideCarousel: false,
    }),
    false
  );
  assert.equal(
    shouldStartPagerLitePointerGesture({
      pointerType: "mouse",
      button: 0,
      startedInsideCarousel: true,
    }),
    false
  );
});

void test("pager lite source captures mouse pointer and resets capture state", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "PagerLite.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /setPointerCapture/);
  assert.match(source, /releasePointerCapture/);
  assert.match(source, /releaseCapturedPointer/);
});
