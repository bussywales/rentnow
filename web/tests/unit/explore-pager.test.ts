import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("explore pager source keeps vertical snap and required testids", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExplorePager.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="explore-pager"/);
  assert.match(source, /data-testid="explore-progress"/);
  assert.match(source, /<ExploreSlide[\s\S]*onGestureLockChange=\{handleGestureLockChange\}[\s\S]*\/>/);
  assert.match(source, /snap-y snap-mandatory/);
  assert.match(source, /h-\[100svh\]/);
  assert.match(source, /resolveExploreAdjacentSlideIndexes/);
  assert.match(source, /shouldPreloadExploreSlideImages/);
  assert.match(source, /handleGestureLockChange/);
  assert.match(source, /WebkitOverflowScrolling: "touch"/);
  assert.match(source, /touchAction: "pan-y pinch-zoom"/);
  assert.match(source, /scrollSnapType = locked \? "none" : "y mandatory"/);
  assert.match(source, /getHiddenExploreListingIds/);
  assert.match(source, /hideExploreListingId/);
  assert.match(source, /console\.count\("\[perf\]\[explore-pager\] render"\)/);
  assert.match(source, /data-testid="explore-hide-undo"/);
  assert.match(source, /data-testid="explore-restore-hidden"/);
});

void test("explore slide source exposes details, hint, and local hide controls", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExploreSlide.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="explore-open-details"/);
  assert.match(source, /data-testid="explore-view-details"/);
  assert.match(source, /data-testid="explore-share-action"/);
  assert.match(source, /data-testid="explore-details-hint"/);
  assert.match(source, /SaveToggle/);
  assert.match(source, /ExploreTrustBadges/);
  assert.match(source, /ExploreDetailsSheet/);
  assert.match(source, /hasSeenExploreDetailsHint/);
  assert.match(source, /markExploreDetailsHintSeen/);
  assert.match(source, /onLongPress=\{handleLongPress\}/);
  assert.match(source, /onGestureLockChange=\{onGestureLockChange\}/);
  assert.match(source, /GlassPill/);
  assert.match(source, /h-11 w-11/);
  assert.match(source, /memo\(ExploreSlideInner/);
  assert.match(source, /console\.count\(`\[perf\]\[explore-slide\] render:/);
});

void test("explore gallery source supports axis locking for horizontal gestures", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExploreGallery.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /resolveExploreGestureAxis/);
  assert.match(source, /normalizeExploreGalleryImageUrl/);
  assert.match(source, /resolveExploreGalleryDisplaySource/);
  assert.match(source, /onGestureLockChange\?\.\(horizontalLockActive\)/);
  assert.match(source, /data-testid="explore-gallery-gesture-layer"/);
  assert.match(source, /data-testid="explore-gallery-image-unavailable"/);
  assert.match(source, /renderWindowRadius=\{1\}/);
  assert.match(source, /className="h-full w-full touch-pan-x"/);
  assert.match(source, /touchAction: horizontalLockActive \? "pan-x pinch-zoom" : "pan-x pan-y pinch-zoom"/);
  assert.match(source, /\[explore-gallery\]\[image-error\]/);
  assert.match(source, /onLongPress\?\.\(\)/);
  assert.match(source, /setTimeout\(\(\) =>/);
  assert.match(source, /memo\(ExploreGalleryInner/);
});

void test("explore details sheet source includes CTA microcopy and similar homes mini rail", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExploreDetailsSheet.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /resolveExplorePrimaryAction/);
  assert.match(source, /resolveExploreCtaMicrocopy/);
  assert.match(source, /resolveExploreTrustBadges/);
  assert.match(source, /data-testid="explore-primary-microcopy"/);
  assert.match(source, /data-testid="explore-similar-homes"/);
  assert.match(source, /data-testid="explore-similar-home"/);
  assert.match(source, /data-testid="explore-primary-cta"/);
  assert.match(source, /data-testid="explore-view-full-details"/);
  assert.match(source, /const shouldRenderDetailsBody = open/);
  assert.match(source, /shouldRenderDetailsBody \? \(/);
});

void test("home quickstart includes explore entry chip without changing search trigger contract", () => {
  const sourcePath = path.join(process.cwd(), "components", "home", "MobileQuickStartBar.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /key: "explore"/);
  assert.match(source, /href: "\/explore"/);
  assert.match(source, /data-testid={`mobile-quickstart-chip-\$\{entry\.key\}`}/);
});

void test("explore route mounts pager and remains mobile-first", () => {
  const sourcePath = path.join(process.cwd(), "app", "explore", "page.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="explore-page"/);
  assert.match(source, /<ExplorePager listings=\{listings\} \/>/);
  assert.match(source, /getExploreFeed/);
});
