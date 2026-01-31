import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyPhotoQuality,
  isPhotoLowQuality,
  PHOTO_MAX_BYTES,
  PHOTO_BLOCK_MIN_HEIGHT,
  PHOTO_BLOCK_MIN_WIDTH,
  PHOTO_WARN_MIN_WIDTH,
} from "@/lib/properties/photo-quality";

void test("classifyPhotoQuality blocks unsupported mime types", () => {
  const res = classifyPhotoQuality({ type: "image/gif", width: 2000, height: 1200 });
  assert.equal(res.status, "block");
  assert.match(res.reason ?? "", /Unsupported file type/i);
});

void test("classifyPhotoQuality blocks oversized files", () => {
  const res = classifyPhotoQuality({
    type: "image/jpeg",
    width: 2000,
    height: 1200,
    bytes: PHOTO_MAX_BYTES + 1,
  });
  assert.equal(res.status, "block");
  assert.match(res.reason ?? "", /10MB/i);
});

void test("classifyPhotoQuality blocks small dimensions", () => {
  const res = classifyPhotoQuality({
    type: "image/jpeg",
    width: PHOTO_BLOCK_MIN_WIDTH - 1,
    height: PHOTO_BLOCK_MIN_HEIGHT - 1,
    bytes: 1000,
  });
  assert.equal(res.status, "block");
  assert.match(res.reason ?? "", /Too small/i);
});

void test("classifyPhotoQuality warns on missing dimensions", () => {
  const res = classifyPhotoQuality({ type: "image/jpeg", bytes: 1000 });
  assert.equal(res.status, "warn");
  assert.match(res.label, /Low resolution/i);
});

void test("classifyPhotoQuality warns below recommended width", () => {
  const res = classifyPhotoQuality({
    type: "image/jpeg",
    width: PHOTO_WARN_MIN_WIDTH - 1,
    height: PHOTO_BLOCK_MIN_HEIGHT + 200,
    bytes: 1000,
  });
  assert.equal(res.status, "warn");
  assert.match(res.label, /Low resolution/i);
});

void test("classifyPhotoQuality returns great quality for large images", () => {
  const res = classifyPhotoQuality({
    type: "image/jpeg",
    width: PHOTO_WARN_MIN_WIDTH + 200,
    height: PHOTO_BLOCK_MIN_HEIGHT + 400,
    bytes: 1000,
  });
  assert.equal(res.status, "great");
  assert.match(res.label, /Great quality/i);
});

void test("isPhotoLowQuality flags warn/block", () => {
  assert.equal(
    isPhotoLowQuality({ type: "image/jpeg", width: 1000, height: 800 }),
    true
  );
  assert.equal(
    isPhotoLowQuality({ type: "image/jpeg", width: PHOTO_WARN_MIN_WIDTH + 1, height: 900 }),
    false
  );
});
