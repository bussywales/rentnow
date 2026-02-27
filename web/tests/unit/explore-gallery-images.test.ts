import test from "node:test";
import assert from "node:assert/strict";
import {
  EXPLORE_GALLERY_FALLBACK_IMAGE,
  normalizeExploreGalleryImageUrl,
  resolveExploreGalleryDisplaySource,
  shouldRenderExploreGalleryImage,
} from "@/lib/explore/gallery-images";

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
