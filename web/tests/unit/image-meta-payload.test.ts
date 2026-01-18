import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeImageMeta } from "@/lib/properties/image-meta";
import { sanitizeExifMeta } from "@/lib/properties/image-exif";

void test("image payload includes sanitized exif metadata", () => {
  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const payload = {
    ...sanitizeImageMeta({ width: 1200, height: 800 }),
    ...sanitizeExifMeta({ hasGps: "true", capturedAt: future }),
  };
  assert.equal(payload.width, 1200);
  assert.equal(payload.height, 800);
  assert.equal(payload.exif_has_gps, true);
  assert.equal(payload.exif_captured_at, null);
});
