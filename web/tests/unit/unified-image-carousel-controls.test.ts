import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldRenderUnifiedImageCarouselControls,
  shouldRenderUnifiedImageCarouselDots,
  shouldSuppressCarouselClickAfterDrag,
} from "@/components/ui/UnifiedImageCarousel";

void test("unified image carousel controls and badge visibility only activate for multi-image sets", () => {
  assert.equal(shouldRenderUnifiedImageCarouselControls(0), false);
  assert.equal(shouldRenderUnifiedImageCarouselControls(1), false);
  assert.equal(shouldRenderUnifiedImageCarouselControls(2), true);
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
