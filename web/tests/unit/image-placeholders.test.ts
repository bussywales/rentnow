import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeHexColor,
  pickDominantColorFallback,
  renderBlurhashToDataUrl,
  resolveImagePlaceholder,
} from "@/lib/images/placeholders";

void test("normalizeHexColor supports 3 and 6 digit hex values", () => {
  assert.equal(normalizeHexColor("#abc"), "#aabbcc");
  assert.equal(normalizeHexColor("112233"), "#112233");
  assert.equal(normalizeHexColor(" #A1B2C3 "), "#a1b2c3");
  assert.equal(normalizeHexColor("blue"), null);
});

void test("pickDominantColorFallback returns deterministic neutral palette colors", () => {
  const a = pickDominantColorFallback("image-a");
  const b = pickDominantColorFallback("image-a");
  const c = pickDominantColorFallback("image-b");
  assert.equal(a, b);
  assert.ok(a.startsWith("#"));
  assert.ok(c.startsWith("#"));
});

void test("renderBlurhashToDataUrl returns a cacheable svg data url", () => {
  const first = renderBlurhashToDataUrl("LKO2?U%2Tw=w]~RBVZRi};RPxuwH");
  const second = renderBlurhashToDataUrl("LKO2?U%2Tw=w]~RBVZRi};RPxuwH");
  assert.ok(first && first.startsWith("data:image/svg+xml,"));
  assert.equal(first, second);
});

void test("resolveImagePlaceholder prioritizes dominant color, then blurhash, then fallback seed", () => {
  const dominant = resolveImagePlaceholder({
    dominantColor: "#123456",
    blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH",
    imageUrl: "https://example.com/a.jpg",
  });
  assert.equal(dominant.source, "dominant_color");
  assert.equal(dominant.dominantColor, "#123456");

  const blurhash = resolveImagePlaceholder({
    blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH",
    imageUrl: "https://example.com/a.jpg",
  });
  assert.equal(blurhash.source, "blurhash");
  assert.ok(blurhash.blurDataURL.startsWith("data:image/svg+xml,"));

  const fallback = resolveImagePlaceholder({
    imageUrl: "https://example.com/no-meta.jpg",
  });
  assert.equal(fallback.source, "fallback");
  assert.ok(fallback.dominantColor.startsWith("#"));
});
