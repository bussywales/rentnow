import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeExifMeta } from "@/lib/properties/image-exif";

void test("sanitizeExifMeta handles undefined and null", () => {
  assert.deepEqual(sanitizeExifMeta(), {});
  assert.deepEqual(sanitizeExifMeta(null as unknown as undefined), {});
});

void test("sanitizeExifMeta coerces hasGps boolean-like values", () => {
  assert.equal(sanitizeExifMeta({ hasGps: true }).exif_has_gps, true);
  assert.equal(sanitizeExifMeta({ hasGps: "true" }).exif_has_gps, true);
  assert.equal(sanitizeExifMeta({ hasGps: "false" }).exif_has_gps, false);
  assert.equal(sanitizeExifMeta({ hasGps: "maybe" }).exif_has_gps, null);
});

void test("sanitizeExifMeta accepts valid capturedAt and rejects invalid/future", () => {
  const iso = "2024-01-01T00:00:00Z";
  assert.equal(
    sanitizeExifMeta({ capturedAt: iso }).exif_captured_at,
    new Date(iso).toISOString()
  );
  assert.deepEqual(sanitizeExifMeta({ capturedAt: "not-a-date" }), {
    exif_captured_at: null,
    exif_has_gps: null,
  });
  const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  assert.deepEqual(sanitizeExifMeta({ capturedAt: future }), {
    exif_captured_at: null,
    exif_has_gps: null,
  });
});
