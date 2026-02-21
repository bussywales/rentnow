import test from "node:test";
import assert from "node:assert/strict";
import { shouldSuppressShortletsCarouselNavigationAfterSwipe } from "@/components/shortlets/search/ShortletsSearchCardCarousel";

void test("swiping beyond threshold suppresses shortlets card navigation click", () => {
  assert.equal(shouldSuppressShortletsCarouselNavigationAfterSwipe(0), false);
  assert.equal(shouldSuppressShortletsCarouselNavigationAfterSwipe(7), false);
  assert.equal(shouldSuppressShortletsCarouselNavigationAfterSwipe(12), true);
});
