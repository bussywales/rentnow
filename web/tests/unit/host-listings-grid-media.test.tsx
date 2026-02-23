import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host listings cards enforce a stable 4:3 compact media rhythm", () => {
  const propertyCardPath = path.join(process.cwd(), "components", "properties", "PropertyCard.tsx");
  const propertyCardSource = fs.readFileSync(propertyCardPath, "utf8");

  assert.match(propertyCardSource, /compact\s*\?\s*"aspect-\[4\/3\]\s+w-full\s+shrink-0\s+flex-none"/);
  assert.match(propertyCardSource, /"card h-full min-w-0 w-full max-w-full overflow-hidden/);
  assert.match(
    propertyCardSource,
    /compact && \(\s*<div\s*className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black\/25 to-transparent"/
  );
});

void test("host listings compact media still relies on object-cover image cropping", () => {
  const carouselPath = path.join(process.cwd(), "components", "ui", "UnifiedImageCarousel.tsx");
  const carouselSource = fs.readFileSync(carouselPath, "utf8");

  assert.match(carouselSource, /className=\{cn\("select-none object-cover", imageClassName\)\}/);
});
