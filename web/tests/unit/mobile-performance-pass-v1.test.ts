import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property skeleton supports surface variants for layout-stable loading states", () => {
  const sourcePath = path.join(process.cwd(), "components", "properties", "PropertyCardSkeleton.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /variant\?: "property" \| "shortlet"/);
  assert.match(source, /variant === "shortlet"/);
  assert.match(source, /h-\[184px\] w-full sm:h-48/);
  assert.match(source, /aspect-\[4\/3\] w-full/);
});

void test("shortlets search shell throttles compact sticky state updates behind requestAnimationFrame", () => {
  const sourcePath = path.join(process.cwd(), "components", "shortlets", "search", "ShortletsSearchShell.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /let rafId: number \| null = null/);
  assert.match(source, /window\.requestAnimationFrame\(applyScrollState\)/);
  assert.match(source, /window\.cancelAnimationFrame\(rafId\)/);
  assert.match(source, /setIsCompactSearch\(\(current\) => \(current === nextCompactState \? current : nextCompactState\)\)/);
});

void test("home rail and shortlets carousel use tuned image delivery hints", () => {
  const homeRailPath = path.join(process.cwd(), "components", "home", "HomeListingRail.tsx");
  const shortletsCarouselPath = path.join(
    process.cwd(),
    "components",
    "shortlets",
    "search",
    "ShortletsSearchCardCarousel.tsx"
  );

  const homeRailSource = fs.readFileSync(homeRailPath, "utf8");
  const shortletsCarouselSource = fs.readFileSync(shortletsCarouselPath, "utf8");

  assert.match(homeRailSource, /placeholder="blur"/);
  assert.match(homeRailSource, /blurDataURL=\{RAIL_IMAGE_BLUR_DATA_URL\}/);
  assert.match(homeRailSource, /sizes="\(max-width: 640px\) 58vw, \(max-width: 1024px\) 240px, 280px"/);

  assert.match(
    shortletsCarouselSource,
    /sizes="\(max-width: 768px\) calc\(100vw - 2rem\), \(max-width: 1280px\) 42vw, 340px"/
  );
});
