import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeListingImageSrc,
  resolveStableListingImageSrc,
} from "@/lib/host/listing-image-stability";

void test("normalizeListingImageSrc trims and null-guards empty values", () => {
  assert.equal(normalizeListingImageSrc("  https://img.example/x.webp  "), "https://img.example/x.webp");
  assert.equal(normalizeListingImageSrc("  "), null);
  assert.equal(normalizeListingImageSrc(null), null);
  assert.equal(normalizeListingImageSrc(undefined), null);
});

void test("resolveStableListingImageSrc keeps first concrete source across rerenders", () => {
  const cache = new Map<string, string | null>();
  const id = "listing-1";

  const first = resolveStableListingImageSrc(cache, id, "https://img.example/hero.webp");
  const second = resolveStableListingImageSrc(cache, id, "https://img.example/card.webp");

  assert.equal(first, "https://img.example/hero.webp");
  assert.equal(second, "https://img.example/hero.webp");
  assert.equal(cache.get(id), "https://img.example/hero.webp");
});

void test("resolveStableListingImageSrc upgrades null source once real source appears", () => {
  const cache = new Map<string, string | null>();
  const id = "listing-2";

  const first = resolveStableListingImageSrc(cache, id, null);
  const second = resolveStableListingImageSrc(cache, id, "https://img.example/real.webp");
  const third = resolveStableListingImageSrc(cache, id, "https://img.example/newer.webp");

  assert.equal(first, null);
  assert.equal(second, "https://img.example/real.webp");
  assert.equal(third, "https://img.example/real.webp");
});
