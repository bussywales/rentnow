import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("explore slide and gallery reserve stable layout height for vertical paging", () => {
  const slideSourcePath = path.join(process.cwd(), "components", "explore", "ExploreSlide.tsx");
  const gallerySourcePath = path.join(process.cwd(), "components", "explore", "ExploreGallery.tsx");
  const slideSource = fs.readFileSync(slideSourcePath, "utf8");
  const gallerySource = fs.readFileSync(gallerySourcePath, "utf8");

  assert.match(slideSource, /className="relative h-\[100svh\] w-full/);
  assert.match(gallerySource, /min-h-\[100svh\]/);
  assert.match(gallerySource, /aspect-\[4\/5\] md:aspect-auto/);
  assert.match(gallerySource, /data-gallery-shell="reserved"/);
  assert.match(gallerySource, /className="h-full min-h-\[100svh\] w-full bg-slate-900"/);
});

void test("explore carousel keeps persistent placeholder layer behind images", () => {
  const carouselSourcePath = path.join(process.cwd(), "components", "ui", "UnifiedImageCarousel.tsx");
  const source = fs.readFileSync(carouselSourcePath, "utf8");

  assert.match(source, /data-placeholder-persistent="true"/);
  assert.match(source, /transition-opacity duration-300/);
});
