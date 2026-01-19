import test from "node:test";
import assert from "node:assert/strict";
import { derivePhotoTrust } from "@/lib/properties/photo-trust";

void test("derivePhotoTrust flags location meta when any image has gps", () => {
  const res = derivePhotoTrust([
    { exif_has_gps: false },
    { exif_has_gps: true, exif_captured_at: "2024-01-01T00:00:00Z" },
  ]);
  assert.equal(res.hasLocationMeta, true);
});

void test("derivePhotoTrust recency recent vs older", () => {
  const recentIso = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const olderIso = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(derivePhotoTrust([{ exif_captured_at: recentIso }]).recency, "recent");
  assert.equal(derivePhotoTrust([{ exif_captured_at: olderIso }]).recency, "older");
});

void test("derivePhotoTrust ignores invalid/future/too-old dates", () => {
  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const tooOld = "1900-01-01T00:00:00Z";
  const res = derivePhotoTrust([
    { exif_captured_at: future },
    { exif_captured_at: tooOld },
    { exif_has_gps: false },
  ]);
  assert.equal(res.recency, "unknown");
});
