import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeImageMeta } from "@/lib/properties/image-meta";

void test("sanitizeImageMeta cleans invalid values and includes blurhash", () => {
  const sanitized = sanitizeImageMeta({
    width: -10,
    height: 50000,
    bytes: -5,
    format: "  JPEG ",
    blurhash: "abc123",
  });
  assert.equal(sanitized.width, null, "negative width should be null");
  assert.equal(sanitized.height, 20000, "height should be clamped to 20000");
  assert.equal(sanitized.bytes, null, "negative bytes should be null");
  assert.equal(sanitized.format, "jpeg", "format should be lowercased and trimmed");
  assert.equal(sanitized.blurhash, "abc123");
});

void test("sanitizeImageMeta allows large bytes beyond 32-bit", () => {
  const sanitized = sanitizeImageMeta({ bytes: 3_000_000_000 });
  assert.equal(sanitized.bytes, 3_000_000_000);
});

void test("sanitizeImageMeta ignores NaN and nulls", () => {
  const sanitized = sanitizeImageMeta({ width: Number.NaN, height: null, bytes: undefined });
  assert.equal(sanitized.width, null);
  assert.equal(sanitized.height, null);
  assert.equal(sanitized.bytes, null);
});

void test("sanitizeImageMeta keeps storage paths and rejects external urls", () => {
  const sanitized = sanitizeImageMeta({
    storage_path: "properties/p-1/img-1/original.jpg",
    card_storage_path: "https://cdn.example.com/card.webp",
    hero_storage_path: "/properties/p-1/img-1/hero.webp",
  });
  assert.equal(sanitized.storage_path, "properties/p-1/img-1/original.jpg");
  assert.equal(sanitized.card_storage_path, null);
  assert.equal(sanitized.hero_storage_path, "properties/p-1/img-1/hero.webp");
});
