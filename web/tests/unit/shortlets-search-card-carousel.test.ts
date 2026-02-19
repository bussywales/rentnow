import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveShortletsCarouselImageSources,
  shouldRenderShortletsCarouselArrows,
  shouldRenderShortletsCarouselDots,
} from "@/components/shortlets/search/ShortletsSearchCardCarousel";

void test("shortlets card carousel shows dots only when image count is greater than three", () => {
  assert.equal(shouldRenderShortletsCarouselDots(1), false);
  assert.equal(shouldRenderShortletsCarouselDots(3), false);
  assert.equal(shouldRenderShortletsCarouselDots(4), true);
});

void test("shortlets card carousel shows arrows when there are multiple images", () => {
  assert.equal(shouldRenderShortletsCarouselArrows(1), false);
  assert.equal(shouldRenderShortletsCarouselArrows(2), true);
});

void test("shortlets card carousel image resolver falls back safely to primary image", () => {
  const sources = resolveShortletsCarouselImageSources({
    coverImageUrl: null,
    primaryImageUrl: "https://example.com/primary.jpg",
    imageUrls: [],
    images: [],
    fallbackImage: "https://example.com/fallback.jpg",
  });

  assert.deepEqual(sources, ["https://example.com/primary.jpg"]);
});

void test("shortlets card carousel image resolver uses explicit imageUrls for swipe gallery", () => {
  const sources = resolveShortletsCarouselImageSources({
    coverImageUrl: null,
    primaryImageUrl: null,
    imageUrls: ["https://example.com/one.jpg", "https://example.com/two.jpg"],
    images: [],
    fallbackImage: "https://example.com/fallback.jpg",
  });

  assert.deepEqual(sources, ["https://example.com/one.jpg", "https://example.com/two.jpg"]);
});
