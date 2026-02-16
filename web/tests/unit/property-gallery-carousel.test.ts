import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveThumbnailTargetIndex,
  shouldRenderGalleryControls,
} from "@/components/properties/PropertyGallery";

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
});
