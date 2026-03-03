import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("explore pager source mounts transform pager engine and required testids", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExplorePager.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /testId="explore-pager"/);
  assert.match(source, /data-testid="explore-progress"/);
  assert.match(source, /<ExplorePagerV3/);
  assert.match(source, /<PagerLite/);
  assert.match(source, /pagerEngine === "lite"/);
  assert.match(source, /renderSlide=\{\(index\) =>/);
  assert.match(source, /<ExploreSlide[\s\S]*onGestureLockChange=\{handleGestureLockChange\}[\s\S]*\/>/);
  assert.match(source, /activeIndex=\{displayedIndex\}/);
  assert.match(source, /onActiveIndexChange=\{handleActiveIndexChange\}/);
  assert.match(source, /gestureLocked=\{isGestureLocked\}/);
  assert.match(source, /const canAdvanceToIndex = useCallback\(\(nextIndex: number\) =>/);
  assert.match(source, /canAdvanceToIndex=\{canAdvanceToIndex\}/);
  assert.match(source, /\[explore\]\[pager-v3\]\[gate-check\]/);
  assert.match(source, /nextImagesCount/);
  assert.match(source, /resolveExploreAdjacentSlideIndexes/);
  assert.match(source, /shouldPreloadExploreSlideImages/);
  assert.match(source, /handleGestureLockChange/);
  assert.match(source, /setIsGestureLocked/);
  assert.match(source, /ExploreSectionHeader/);
  assert.match(source, /resolveExploreSectionByListingId/);
  assert.match(source, /resolveExploreSlideShellReady/);
  assert.match(source, /total=\{feedSize\}/);
  assert.match(source, /getHiddenExploreListingIds/);
  assert.match(source, /hideExploreListingId/);
  assert.match(source, /console\.count\("\[perf\]\[explore-pager\] render"\)/);
  assert.match(source, /data-testid="explore-hide-undo"/);
  assert.match(source, /data-testid="explore-restore-hidden"/);
  assert.doesNotMatch(source, /snap-y snap-mandatory/);
  assert.doesNotMatch(source, /WebkitOverflowScrolling: "touch"/);
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
  assert.match(source, /resolveExplorePriceCopy/);
  assert.match(source, /resolveExploreStayContextFromSearchParams/);
  assert.match(source, /ExploreDetailsSheet/);
  assert.match(source, /hasSeenExploreDetailsHint/);
  assert.match(source, /markExploreDetailsHintSeen/);
  assert.match(source, /onLongPress=\{handleLongPress\}/);
  assert.match(source, /onGestureLockChange=\{onGestureLockChange\}/);
  assert.match(source, /GlassPill/);
  assert.match(source, /h-11 w-11/);
  assert.match(source, /data-testid="explore-price-primary"/);
  assert.match(source, /data-testid="explore-price-est-total"/);
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
  assert.match(source, /slideDistance = 0/);
  assert.match(source, /shouldRestrictExploreSlideToHeroImage/);
  assert.match(source, /renderWindowRadius=\{renderWindowRadius\}/);
  assert.match(source, /resolveExploreGalleryMaxConcurrentImageLoads/);
  assert.match(source, /aspect-\[4\/5\] md:aspect-auto touch-pan-x/);
  assert.match(source, /aspect-\[4\/5\] md:aspect-auto touch-pan-y/);
  assert.match(source, /data-gallery-shell="reserved"/);
  assert.match(source, /touchAction: canSwipeImages/);
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
  assert.match(source, /resolveExplorePriceCopy/);
  assert.match(source, /resolveExploreStayContextFromSearchParams/);
  assert.match(source, /data-testid="explore-primary-microcopy"/);
  assert.match(source, /data-testid="explore-details-price-primary"/);
  assert.match(source, /data-testid="explore-details-price-est-total"/);
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

  assert.match(source, /showExploreChip\?: boolean/);
  assert.match(source, /showExploreChip = true/);
  assert.match(source, /QUICK_START_LINKS\.filter\(\(entry\) => entry\.key !== "explore"\)/);
  assert.match(source, /key: "explore"/);
  assert.match(source, /href: "\/explore"/);
  assert.match(source, /data-testid={`mobile-quickstart-chip-\$\{entry\.key\}`}/);
});

void test("explore route reads kill-switch and shows disabled state when needed", () => {
  const sourcePath = path.join(process.cwd(), "app", "explore", "page.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /isExploreEnabled/);
  assert.match(source, /data-testid="explore-disabled-screen"/);
  assert.match(source, /Try Explore Labs/);
  assert.match(source, /data-testid="explore-page"/);
  assert.match(source, /<ExplorePager/);
  assert.match(source, /sectionMeta=\{sectionedFeed\.meta\}/);
  assert.match(source, /marketPickIds=\{sectionedFeed\.marketPicks\.map/);
  assert.match(source, /moreToExploreIds=\{sectionedFeed\.moreToExplore\.map/);
  assert.match(source, /getSectionedExploreFeed/);
});

void test("explore-labs route mounts pager lite while preserving explore slide stack", () => {
  const sourcePath = path.join(process.cwd(), "app", "explore-labs", "page.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="explore-labs-page"/);
  assert.match(source, /pagerEngine="lite"/);
  assert.match(source, /<ExplorePager/);
  assert.match(source, /getSectionedExploreFeed/);
});
