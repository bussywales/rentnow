import test from "node:test";
import assert from "node:assert/strict";
import {
  hasPropertyVideoRecords,
  normalizePropertyVideoRecords,
  resolvePropertyHasVideoSignal,
} from "@/lib/properties/video-signal.server";

void test("normalizePropertyVideoRecords wraps one-to-one relation objects into arrays", () => {
  const normalized = normalizePropertyVideoRecords({
    id: "video-1",
    video_url: "https://example.test/listing.mp4",
  });

  assert.deepEqual(normalized, [
    {
      id: "video-1",
      video_url: "https://example.test/listing.mp4",
    },
  ]);
});

void test("hasPropertyVideoRecords accepts storage-path-only rows", () => {
  assert.equal(
    hasPropertyVideoRecords([
      {
        id: "video-1",
        storage_path: "property-videos/listing.mp4",
      },
    ]),
    true
  );
});

void test("resolvePropertyHasVideoSignal respects explicit booleans first", () => {
  assert.equal(
    resolvePropertyHasVideoSignal({
      hasVideo: false,
      propertyVideos: [{ id: "video-1", video_url: "https://example.test/listing.mp4" }],
      featuredMedia: "video",
      allowFeaturedMediaFallback: true,
    }),
    false
  );
});

void test("resolvePropertyHasVideoSignal falls back to featured media when public relation is hidden", () => {
  assert.equal(
    resolvePropertyHasVideoSignal({
      hasVideo: null,
      propertyVideos: null,
      featuredMedia: "video",
      allowFeaturedMediaFallback: true,
    }),
    true
  );
});

void test("resolvePropertyHasVideoSignal stays false for image-first listings without any signal", () => {
  assert.equal(
    resolvePropertyHasVideoSignal({
      hasVideo: null,
      propertyVideos: null,
      featuredMedia: "image",
      allowFeaturedMediaFallback: true,
    }),
    false
  );
});
