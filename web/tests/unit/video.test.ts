import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_VIDEO_TYPES,
  MAX_VIDEO_BYTES,
  isAllowedVideoSize,
  isAllowedVideoType,
  resolveVideoBucket,
  videoExtensionForType,
} from "@/lib/properties/video";

void test("accepts only allowed video mime types", () => {
  for (const type of ALLOWED_VIDEO_TYPES) {
    assert.equal(isAllowedVideoType(type), true);
  }
  assert.equal(isAllowedVideoType("application/mp4"), true);
  assert.equal(isAllowedVideoType("video/quicktime"), false);
  assert.equal(isAllowedVideoType("video/avi"), false);
  assert.equal(isAllowedVideoType(null), false);
});

void test("enforces max video size of 20MB", () => {
  assert.equal(isAllowedVideoSize(MAX_VIDEO_BYTES), true);
  assert.equal(isAllowedVideoSize(MAX_VIDEO_BYTES + 1), false);
});

void test("resolves file extension for video types", () => {
  assert.equal(videoExtensionForType("video/mp4"), "mp4");
  assert.equal(videoExtensionForType(undefined), "mp4");
});

void test("resolves video bucket with server/client fallback", () => {
  const originalServer = process.env.SUPABASE_VIDEO_STORAGE_BUCKET;
  const originalClient = process.env.NEXT_PUBLIC_SUPABASE_VIDEO_STORAGE_BUCKET;
  delete process.env.SUPABASE_VIDEO_STORAGE_BUCKET;
  delete process.env.NEXT_PUBLIC_SUPABASE_VIDEO_STORAGE_BUCKET;
  assert.equal(resolveVideoBucket(), "property-videos");
  process.env.NEXT_PUBLIC_SUPABASE_VIDEO_STORAGE_BUCKET = "client-bucket";
  assert.equal(resolveVideoBucket(), "client-bucket");
  process.env.SUPABASE_VIDEO_STORAGE_BUCKET = "server-bucket";
  assert.equal(resolveVideoBucket(), "server-bucket");
  process.env.SUPABASE_VIDEO_STORAGE_BUCKET = originalServer;
  process.env.NEXT_PUBLIC_SUPABASE_VIDEO_STORAGE_BUCKET = originalClient;
});
