import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  resolvePropertyGalleryImages,
  resolveThumbnailTargetIndex,
  shouldRenderGalleryControls,
  shouldRenderGalleryThumbnails,
} from "@/components/properties/PropertyGallery";

const propertyGalleryPath = path.join(process.cwd(), "components", "properties", "PropertyGallery.tsx");

void test("thumbnail click target resolves to the active slide index", () => {
  assert.equal(resolveThumbnailTargetIndex(2, 5), 2);
  assert.equal(resolveThumbnailTargetIndex(0, 5), 0);
  assert.equal(resolveThumbnailTargetIndex(99, 5), 4);
  assert.equal(resolveThumbnailTargetIndex(-4, 5), 0);
});

void test("detail gallery uses one canonical ordered image array for carousel and thumbnails", () => {
  const ordered = resolvePropertyGalleryImages(
    [
      {
        id: "cover",
        image_url: "https://cdn.example.com/cover.jpg",
        position: 12,
      },
      {
        id: "first",
        image_url: "https://cdn.example.com/first.jpg",
        position: 0,
      },
      {
        id: "second",
        image_url: "https://cdn.example.com/second.jpg",
        position: 1,
      },
    ],
    "https://cdn.example.com/cover.jpg"
  );

  assert.deepEqual(
    ordered.map((image) => image.id),
    ["cover", "first", "second"]
  );
});

void test("detail gallery controls only render for multi-image listings", () => {
  assert.equal(shouldRenderGalleryControls(0), false);
  assert.equal(shouldRenderGalleryControls(1), false);
  assert.equal(shouldRenderGalleryControls(2), true);
  assert.equal(shouldRenderGalleryThumbnails(0), false);
  assert.equal(shouldRenderGalleryThumbnails(1), false);
  assert.equal(shouldRenderGalleryThumbnails(2), true);
});

void test("detail gallery keeps thumbnail and swipe selection in sync via shared controller hooks", () => {
  const contents = fs.readFileSync(propertyGalleryPath, "utf8");

  assert.ok(contents.includes("resolvePropertyGalleryImages(images.length ? images : [], coverImageUrl)"));
  assert.ok(contents.includes('rootTestId="property-detail-gallery-carousel"'));
  assert.ok(contents.includes("enableActiveSlideMotion"));
  assert.ok(contents.includes('if (e.key === "ArrowLeft")'));
  assert.ok(contents.includes('if (e.key === "ArrowRight")'));
  assert.ok(contents.includes("onSelectedIndexChange={setSelectedIndex}"));
  assert.ok(contents.includes("carouselController?.scrollTo(targetIndex)"));
  assert.ok(contents.includes("carouselController?.scrollPrev()"));
  assert.ok(contents.includes("carouselController?.scrollNext()"));
});

void test("detail gallery thumbnail rail includes premium fade edges", () => {
  const contents = fs.readFileSync(propertyGalleryPath, "utf8");

  assert.ok(contents.includes("property-gallery-thumbnail-fade-left"));
  assert.ok(contents.includes("property-gallery-thumbnail-fade-right"));
});

void test("detail gallery normalizes thumbnail/image sources and uses local fallback", () => {
  const contents = fs.readFileSync(propertyGalleryPath, "utf8");

  assert.ok(contents.includes('const fallbackImage = "/og-propatyhub.png"'));
  assert.ok(contents.includes("coverImageUrl?: string | null;"));
  assert.ok(contents.includes('resolvePropertyImageUrl(img, "thumb")'));
  assert.ok(contents.includes('resolvePropertyImageUrl(img, "hero")'));
  assert.ok(contents.includes('const optimizationMode = useImageOptimizationMode()'));
  assert.ok(contents.includes("const unoptimized = shouldDisableImageOptimizationForUsage({"));
  assert.ok(contents.includes('usage: "critical"'));
  assert.ok(contents.includes("unoptimized={unoptimized}"));
});
