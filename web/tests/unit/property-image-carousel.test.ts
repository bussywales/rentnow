import test from "node:test";
import assert from "node:assert/strict";
import {
  resolvePropertyImageSources,
  shouldRenderImageCountBadge,
} from "@/components/properties/PropertyImageCarousel";

void test("property image carousel renders count badge for multiple images", () => {
  assert.equal(shouldRenderImageCountBadge(2), true);
  assert.equal(shouldRenderImageCountBadge(24), true);
});

void test("property image carousel hides count badge for a single image", () => {
  assert.equal(shouldRenderImageCountBadge(1), false);
  assert.equal(shouldRenderImageCountBadge(0), false);
});

void test("property image carousel does not use fallback when cover image exists", () => {
  const fallback = "https://images.unsplash.com/fallback.jpg";
  const sources = resolvePropertyImageSources({
    coverImageUrl: "https://cdn.example.com/cover.jpg",
    primaryImageUrl: null,
    fallbackImage: fallback,
    images: [
      {
        id: "img-1",
        image_url: "https://cdn.example.com/cover.jpg",
      },
      {
        id: "img-2",
        image_url: "https://cdn.example.com/second.jpg",
      },
    ],
  });

  assert.equal(sources[0], "https://cdn.example.com/cover.jpg");
  assert.equal(sources.includes(fallback), false);
});
