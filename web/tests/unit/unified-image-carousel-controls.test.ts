import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveCarouselWheelDelta,
  resolveCarouselWheelDirection,
  shouldThrottleCarouselWheelNavigation,
  shouldHandleCarouselWheelGesture,
  shouldRenderUnifiedImageCarouselCountBadge,
  shouldRenderUnifiedImageCarouselControls,
  shouldRenderUnifiedImageCarouselDots,
  shouldSuppressCarouselClickAfterDrag,
} from "@/components/ui/UnifiedImageCarousel";

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
  assert.equal(resolveCarouselWheelDelta({ deltaX: 36, deltaY: 4, shiftKey: false }), 36);
  assert.equal(resolveCarouselWheelDelta({ deltaX: 0, deltaY: 48, shiftKey: true }), 48);
});

void test("unified image carousel handles only meaningful horizontal wheel gestures", () => {
  assert.equal(shouldHandleCarouselWheelGesture({ deltaX: 24, deltaY: 2, shiftKey: false }), true);
  assert.equal(shouldHandleCarouselWheelGesture({ deltaX: 2, deltaY: 24, shiftKey: false }), false);
  assert.equal(shouldHandleCarouselWheelGesture({ deltaX: 0, deltaY: 40, shiftKey: true }), true);
  assert.equal(shouldHandleCarouselWheelGesture({ deltaX: 1, deltaY: 18, shiftKey: false }), false);
});

void test("unified image carousel wheel direction mapping supports both directions", () => {
  assert.equal(resolveCarouselWheelDirection({ deltaX: 18, deltaY: 1, shiftKey: false }), "next");
  assert.equal(resolveCarouselWheelDirection({ deltaX: -18, deltaY: 1, shiftKey: false }), "prev");
});

void test("unified image carousel wheel direction mapping supports shift+wheel fallback both directions", () => {
  assert.equal(resolveCarouselWheelDirection({ deltaX: 0, deltaY: 24, shiftKey: true }), "next");
  assert.equal(resolveCarouselWheelDirection({ deltaX: 0, deltaY: -24, shiftKey: true }), "prev");
});

void test("unified image carousel wheel throttle blocks repeated direction but allows instant direction reversal", () => {
  assert.equal(
    shouldThrottleCarouselWheelNavigation({
      nowMs: 1_000,
      lastTriggeredAtMs: 920,
      nextDirection: "next",
      lastDirection: "next",
      throttleMs: 160,
    }),
    true
  );

  assert.equal(
    shouldThrottleCarouselWheelNavigation({
      nowMs: 1_000,
      lastTriggeredAtMs: 920,
      nextDirection: "prev",
      lastDirection: "next",
      throttleMs: 160,
    }),
    false
  );
});
