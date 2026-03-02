import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPLORE_GALLERY_FALLBACK_IMAGE,
  normalizeExploreGalleryImageUrl,
  resolveExplorePropertyImageRecords,
  resolveExploreGalleryDisplaySource,
  shouldRenderExploreGalleryImage,
} from "@/lib/explore/gallery-images";
import {
  resolveExploreGalleryMaxConcurrentImageLoads,
  resolveExploreGalleryRenderWindowRadius,
  shouldRestrictExploreSlideToHeroImage,
} from "@/components/explore/ExploreGallery";

void test("explore gallery normalizes secure urls and upgrades allowed insecure hosts", () => {
  const secure = normalizeExploreGalleryImageUrl("https://vfospznoluqoklmgjgea.supabase.co/path/image.webp");
  assert.equal(secure, "https://vfospznoluqoklmgjgea.supabase.co/path/image.webp");

  const upgraded = normalizeExploreGalleryImageUrl("http://vfospznoluqoklmgjgea.supabase.co/path/image.webp");
  assert.equal(upgraded, "https://vfospznoluqoklmgjgea.supabase.co/path/image.webp");
});

void test("explore gallery rejects unsafe/incomplete urls to fallback placeholder", () => {
  assert.equal(normalizeExploreGalleryImageUrl("http://example.com/image.jpg"), EXPLORE_GALLERY_FALLBACK_IMAGE);
  assert.equal(normalizeExploreGalleryImageUrl(""), EXPLORE_GALLERY_FALLBACK_IMAGE);
  assert.equal(normalizeExploreGalleryImageUrl("not-a-url"), EXPLORE_GALLERY_FALLBACK_IMAGE);
});

void test("explore gallery windowing keeps only active and adjacent images renderable", () => {
  assert.equal(shouldRenderExploreGalleryImage(0, 0, 6, 1), true);
  assert.equal(shouldRenderExploreGalleryImage(1, 0, 6, 1), true);
  assert.equal(shouldRenderExploreGalleryImage(2, 0, 6, 1), false);
  assert.equal(shouldRenderExploreGalleryImage(4, 3, 6, 1), true);
});

void test("explore gallery display source falls back for failed images", () => {
  const failedIndexes = new Set<number>([2]);
  assert.equal(
    resolveExploreGalleryDisplaySource({
      imageUrl: "https://vfospznoluqoklmgjgea.supabase.co/path/ok.webp",
      imageIndex: 2,
      activeIndex: 2,
      totalImages: 6,
      failedIndexes,
    }),
    EXPLORE_GALLERY_FALLBACK_IMAGE
  );
});

void test("explore gallery restricts adjacent slides to hero image in conserve mode", () => {
  assert.equal(shouldRestrictExploreSlideToHeroImage(true, 1), true);
  assert.equal(shouldRestrictExploreSlideToHeroImage(true, 2), true);
  assert.equal(shouldRestrictExploreSlideToHeroImage(true, 0), false);
  assert.equal(shouldRestrictExploreSlideToHeroImage(false, 1), false);
});

void test("explore gallery window and concurrency hints prefer conservative defaults on weak data", () => {
  assert.equal(
    resolveExploreGalleryRenderWindowRadius({
      canSwipeImages: true,
      shouldConserveData: true,
    }),
    1
  );
  assert.equal(
    resolveExploreGalleryRenderWindowRadius({
      canSwipeImages: false,
      shouldConserveData: true,
    }),
    0
  );
  assert.equal(resolveExploreGalleryMaxConcurrentImageLoads(true), 2);
  assert.equal(resolveExploreGalleryMaxConcurrentImageLoads(false), 4);
});

void test("explore gallery resolves full image records from images and property_images relations", () => {
  const resolved = resolveExplorePropertyImageRecords({
    images: [
      { id: "cover", image_url: "https://vfospznoluqoklmgjgea.supabase.co/cover.webp" },
    ],
    property_images: [
      { id: "cover", image_url: "https://vfospznoluqoklmgjgea.supabase.co/cover.webp" },
      { id: "detail-1", image_url: "https://vfospznoluqoklmgjgea.supabase.co/detail-1.webp" },
      { id: "detail-2", image_url: "https://vfospznoluqoklmgjgea.supabase.co/detail-2.webp" },
    ],
  });
  assert.equal(resolved.length, 3);
  assert.deepEqual(
    resolved.map((image) => image.id),
    ["cover", "detail-1", "detail-2"]
  );
});
