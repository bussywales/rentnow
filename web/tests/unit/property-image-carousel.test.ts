import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  resolvePropertyImageSources,
  shouldRenderImageCountBadge,
} from "@/components/properties/PropertyImageCarousel";

const propertyCarouselPath = path.join(
  process.cwd(),
  "components",
  "properties",
  "PropertyImageCarousel.tsx"
);

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

void test("property image carousel uses unified carousel foundation with shared control markers", () => {
  const contents = fs.readFileSync(propertyCarouselPath, "utf8");

  assert.ok(contents.includes("UnifiedImageCarousel"));
  assert.ok(contents.includes('rootTestId={rootTestId}'));
  assert.ok(contents.includes("showArrows={shouldRenderImageCountBadge(carouselItems.length)}"));
  assert.ok(contents.includes("prioritizeFirstImage={prioritizeFirstImage}"));
});
