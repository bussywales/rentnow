import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  resolveShortletsCarouselImageLoading,
  shouldRenderShortletsCarouselControls,
  resolveShortletsCarouselIndexFromScroll,
  resolveShortletsCarouselImageSources,
  shouldRenderShortletsCarouselArrows,
  shouldRenderShortletsCarouselDots,
  shouldSuppressShortletsCarouselNavigationAfterSwipe,
} from "@/components/shortlets/search/ShortletsSearchCardCarousel";

const shortletsCarouselPath = path.join(
  process.cwd(),
  "components",
  "shortlets",
  "search",
  "ShortletsSearchCardCarousel.tsx"
);

void test("shortlets card carousel shows dots only when image count is greater than three", () => {
  assert.equal(shouldRenderShortletsCarouselDots(1), false);
  assert.equal(shouldRenderShortletsCarouselDots(3), false);
  assert.equal(shouldRenderShortletsCarouselDots(4), true);
});

void test("shortlets card carousel shows arrows when there are multiple images", () => {
  assert.equal(shouldRenderShortletsCarouselArrows(1), false);
  assert.equal(shouldRenderShortletsCarouselArrows(2), true);
  assert.equal(shouldRenderShortletsCarouselControls(1), false);
  assert.equal(shouldRenderShortletsCarouselControls(2), true);
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

void test("shortlets card carousel resolves active index from scroll position", () => {
  assert.equal(
    resolveShortletsCarouselIndexFromScroll({
      scrollLeft: 0,
      slideWidth: 320,
      totalImages: 5,
    }),
    0
  );
  assert.equal(
    resolveShortletsCarouselIndexFromScroll({
      scrollLeft: 350,
      slideWidth: 320,
      totalImages: 5,
    }),
    1
  );
  assert.equal(
    resolveShortletsCarouselIndexFromScroll({
      scrollLeft: 1650,
      slideWidth: 320,
      totalImages: 5,
    }),
    4
  );
});

void test("shortlets card carousel image loading profile only prioritises first image when requested", () => {
  assert.deepEqual(
    resolveShortletsCarouselImageLoading({
      index: 0,
      prioritizeFirstImage: true,
    }),
    {
      priority: true,
      loading: "eager",
      fetchPriority: "high",
    }
  );

  assert.deepEqual(
    resolveShortletsCarouselImageLoading({
      index: 1,
      prioritizeFirstImage: true,
    }),
    {
      priority: false,
      loading: "lazy",
      fetchPriority: "auto",
    }
  );

  assert.deepEqual(
    resolveShortletsCarouselImageLoading({
      index: 0,
      prioritizeFirstImage: false,
    }),
    {
      priority: false,
      loading: "lazy",
      fetchPriority: "auto",
    }
  );
});

void test("shortlets card carousel suppresses navigation after swipe gestures", () => {
  assert.equal(shouldSuppressShortletsCarouselNavigationAfterSwipe(4), false);
  assert.equal(shouldSuppressShortletsCarouselNavigationAfterSwipe(9), true);
});

void test("shortlets card carousel uses unified carousel foundation with shared control markers", () => {
  const contents = fs.readFileSync(shortletsCarouselPath, "utf8");

  assert.ok(contents.includes("UnifiedImageCarousel"));
  assert.ok(contents.includes('from "@/lib/carousel/interaction"'));
  assert.ok(contents.includes('from "@/lib/images/loading-profile"'));
  assert.ok(contents.includes("shouldSuppressCarouselClickAfterDrag"));
  assert.ok(contents.includes("resolveImageLoadingProfile"));
  assert.ok(contents.includes('rootTestId="shortlets-search-card-carousel"'));
  assert.ok(contents.includes('dotsTestId="shortlets-search-card-carousel-dots"'));
});
