import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  shouldRenderUnifiedImageCarouselCountBadge,
  shouldRenderUnifiedImageCarouselControls,
  shouldRenderUnifiedImageCarouselDots,
} from "@/components/ui/UnifiedImageCarousel";
import {
  accumulateWheelDelta,
  resolveWheelDelta,
  resolveWheelDirection,
  shouldSuppressCarouselClickAfterDrag,
  shouldThrottleWheelNavigation,
  shouldTreatWheelAsHorizontal,
} from "@/lib/ui/carousel-interactions";

const unifiedCarouselPath = path.join(process.cwd(), "components", "ui", "UnifiedImageCarousel.tsx");

void test("unified image carousel controls and badge visibility only activate for multi-image sets", () => {
  assert.equal(shouldRenderUnifiedImageCarouselControls(0), false);
  assert.equal(shouldRenderUnifiedImageCarouselControls(1), false);
  assert.equal(shouldRenderUnifiedImageCarouselControls(2), true);
  assert.equal(shouldRenderUnifiedImageCarouselCountBadge(1), false);
  assert.equal(shouldRenderUnifiedImageCarouselCountBadge(2), true);
});

void test("unified image carousel dots follow a consistent threshold", () => {
  assert.equal(shouldRenderUnifiedImageCarouselDots(1), false);
  assert.equal(shouldRenderUnifiedImageCarouselDots(3), false);
  assert.equal(shouldRenderUnifiedImageCarouselDots(4), true);
});

void test("unified image carousel suppresses click navigation only after drag threshold", () => {
  assert.equal(shouldSuppressCarouselClickAfterDrag(4), false);
  assert.equal(shouldSuppressCarouselClickAfterDrag(8), false);
  assert.equal(shouldSuppressCarouselClickAfterDrag(9), true);
});

void test("unified image carousel resolves horizontal wheel deltas for trackpad and shift-scroll", () => {
  assert.equal(resolveWheelDelta({ deltaX: 36, deltaY: 4, shiftKey: false }), 36);
  assert.equal(resolveWheelDelta({ deltaX: 0, deltaY: 48, shiftKey: true }), 48);
});

void test("unified image carousel handles only meaningful horizontal wheel gestures", () => {
  assert.equal(shouldTreatWheelAsHorizontal({ deltaX: 24, deltaY: 2, shiftKey: false }), true);
  assert.equal(shouldTreatWheelAsHorizontal({ deltaX: 2, deltaY: 24, shiftKey: false }), false);
  assert.equal(shouldTreatWheelAsHorizontal({ deltaX: 0, deltaY: 40, shiftKey: true }), true);
  assert.equal(shouldTreatWheelAsHorizontal({ deltaX: 1, deltaY: 18, shiftKey: false }), false);
});

void test("unified image carousel wheel direction mapping supports both directions", () => {
  assert.equal(resolveWheelDirection({ deltaX: 18, deltaY: 1, shiftKey: false }), "next");
  assert.equal(resolveWheelDirection({ deltaX: -18, deltaY: 1, shiftKey: false }), "prev");
});

void test("unified image carousel wheel direction mapping supports shift+wheel fallback both directions", () => {
  assert.equal(resolveWheelDirection({ deltaX: 0, deltaY: 24, shiftKey: true }), "next");
  assert.equal(resolveWheelDirection({ deltaX: 0, deltaY: -24, shiftKey: true }), "prev");
});

void test("unified image carousel wheel accumulation resets when direction changes", () => {
  assert.equal(
    accumulateWheelDelta({
      accumulatedDelta: 16,
      nextDelta: -5,
    }),
    -5
  );
  assert.equal(
    accumulateWheelDelta({
      accumulatedDelta: -20,
      nextDelta: 7,
    }),
    7
  );
});

void test("unified image carousel wheel throttle blocks repeated direction but allows instant direction reversal", () => {
  assert.equal(
    shouldThrottleWheelNavigation({
      nowMs: 1_000,
      lastTriggeredAtMs: 920,
      nextDirection: "next",
      lastDirection: "next",
      throttleMs: 160,
    }),
    true
  );

  assert.equal(
    shouldThrottleWheelNavigation({
      nowMs: 1_000,
      lastTriggeredAtMs: 920,
      nextDirection: "prev",
      lastDirection: "next",
      throttleMs: 160,
    }),
    false
  );
});

void test("unified image carousel consumes the shared interaction policy module", () => {
  const contents = fs.readFileSync(unifiedCarouselPath, "utf8");
  assert.ok(contents.includes('from "@/lib/ui/carousel-interactions"'));
  assert.ok(contents.includes('from "@/lib/images/loading-profile"'));
  assert.ok(contents.includes("shouldTreatWheelAsHorizontal(event)"));
  assert.ok(contents.includes("accumulateWheelDelta"));
  assert.ok(contents.includes("resolveWheelDirectionFromAccumulatedDelta"));
  assert.ok(contents.includes("resolveImageLoadingProfile"));
});
