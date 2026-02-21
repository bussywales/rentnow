import test from "node:test";
import assert from "node:assert/strict";
import {
  applyInertialSnapHint,
  resolveWheelDelta,
  resolveWheelDirection,
  resolveWheelDirectionFromAccumulatedDelta,
  shouldSuppressCarouselClickAfterDrag,
  shouldThrottleWheelNavigation,
  shouldTreatWheelAsHorizontal,
} from "@/lib/carousel/interaction";

void test("wheel direction resolves bidirectionally from horizontal deltas", () => {
  assert.equal(resolveWheelDirection({ deltaX: 120, deltaY: 0, shiftKey: false }), "next");
  assert.equal(resolveWheelDirection({ deltaX: -120, deltaY: 0, shiftKey: false }), "prev");
});

void test("wheel direction resolves bidirectionally from shift+wheel fallback", () => {
  assert.equal(resolveWheelDirection({ deltaX: 0, deltaY: 120, shiftKey: true }), "next");
  assert.equal(resolveWheelDirection({ deltaX: 0, deltaY: -120, shiftKey: true }), "prev");
});

void test("horizontal wheel intent ignores mostly-vertical gestures", () => {
  assert.equal(shouldTreatWheelAsHorizontal({ deltaX: 1, deltaY: 24, shiftKey: false }), false);
  assert.equal(shouldTreatWheelAsHorizontal({ deltaX: 24, deltaY: 2, shiftKey: false }), true);
});

void test("wheel delta prefers shift+wheel vertical fallback when stronger than horizontal", () => {
  assert.equal(resolveWheelDelta({ deltaX: 3, deltaY: 32, shiftKey: true }), 32);
  assert.equal(resolveWheelDelta({ deltaX: 20, deltaY: 5, shiftKey: true }), 20);
});

void test("accumulated deltas resolve direction after threshold crossings", () => {
  assert.equal(resolveWheelDirectionFromAccumulatedDelta(3), null);
  assert.equal(resolveWheelDirectionFromAccumulatedDelta(7), "next");
  assert.equal(resolveWheelDirectionFromAccumulatedDelta(-7), "prev");
});

void test("click suppression threshold is symmetric for both drag directions", () => {
  assert.equal(shouldSuppressCarouselClickAfterDrag(8), false);
  assert.equal(shouldSuppressCarouselClickAfterDrag(9), true);
});

void test("wheel throttle blocks repeated direction bursts but allows immediate reversal", () => {
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

void test("inertial snap hint remains reduced-motion safe", () => {
  assert.equal(applyInertialSnapHint({ enabled: true, isActive: true, reducedMotion: true }), "");
  assert.equal(
    applyInertialSnapHint({ enabled: true, isActive: true, reducedMotion: false }),
    "scale-[1.005] opacity-100"
  );
  assert.equal(
    applyInertialSnapHint({ enabled: true, isActive: false, reducedMotion: false }),
    "scale-[0.995] opacity-95"
  );
});
