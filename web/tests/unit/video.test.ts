import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_VIDEO_TYPES,
  MAX_VIDEO_BYTES,
  isAllowedVideoSize,
  isAllowedVideoType,
  videoExtensionForType,
} from "@/lib/properties/video";

void test("accepts only allowed video mime types", () => {
  for (const type of ALLOWED_VIDEO_TYPES) {
    assert.equal(isAllowedVideoType(type), true);
  }
  assert.equal(isAllowedVideoType("video/avi"), false);
  assert.equal(isAllowedVideoType(null), false);
});

void test("enforces max video size of 20MB", () => {
  assert.equal(isAllowedVideoSize(MAX_VIDEO_BYTES), true);
  assert.equal(isAllowedVideoSize(MAX_VIDEO_BYTES + 1), false);
});

void test("resolves file extension for video types", () => {
  assert.equal(videoExtensionForType("video/mp4"), "mp4");
  assert.equal(videoExtensionForType("video/quicktime"), "mov");
  assert.equal(videoExtensionForType(undefined), "mp4");
});
