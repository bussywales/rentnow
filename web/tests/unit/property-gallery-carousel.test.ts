import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
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
