import test from "node:test";
import assert from "node:assert/strict";
import {
  accumulateWheelDelta,
  resolveWheelDirection,
  shouldSuppressCarouselClickAfterDrag,
  shouldTreatWheelAsHorizontal,
} from "@/lib/ui/carousel-interactions";

void test("carousel interaction core maps both wheel directions", () => {
  assert.equal(resolveWheelDirection({ deltaX: 120, deltaY: 0, shiftKey: false }), "next");
  assert.equal(resolveWheelDirection({ deltaX: -120, deltaY: 0, shiftKey: false }), "prev");
});

void test("carousel interaction core supports shift+wheel fallback in both directions", () => {
  assert.equal(resolveWheelDirection({ deltaX: 0, deltaY: 120, shiftKey: true }), "next");
  assert.equal(resolveWheelDirection({ deltaX: 0, deltaY: -120, shiftKey: true }), "prev");
});

void test("carousel interaction core treats horizontal intent symmetrically", () => {
  assert.equal(shouldTreatWheelAsHorizontal({ deltaX: 24, deltaY: 2, shiftKey: false }), true);
  assert.equal(shouldTreatWheelAsHorizontal({ deltaX: -24, deltaY: 2, shiftKey: false }), true);
  assert.equal(shouldTreatWheelAsHorizontal({ deltaX: 1, deltaY: 18, shiftKey: false }), false);
});

void test("carousel interaction accumulator resets when gesture direction flips", () => {
  assert.equal(
    accumulateWheelDelta({
      accumulatedDelta: 18,
      nextDelta: -4,
    }),
    -4
  );
  assert.equal(
    accumulateWheelDelta({
      accumulatedDelta: -12,
      nextDelta: 6,
    }),
    6
  );
});

void test("carousel interaction click suppression threshold remains stable", () => {
  assert.equal(shouldSuppressCarouselClickAfterDrag(8), false);
  assert.equal(shouldSuppressCarouselClickAfterDrag(9), true);
});
