import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("explore pager source keeps vertical snap and required testids", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExplorePager.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="explore-pager"/);
  assert.match(source, /data-testid="explore-progress"/);
  assert.match(source, /<ExploreSlide[\s\S]*onGestureLockChange=\{setVerticalScrollLocked\}[\s\S]*\/>/);
  assert.match(source, /snap-y snap-mandatory/);
  assert.match(source, /h-\[100svh\]/);
  assert.match(source, /resolveExploreAdjacentSlideIndexes/);
  assert.match(source, /shouldPreloadExploreSlideImages/);
  assert.match(source, /overflowY: verticalScrollLocked \? "hidden" : "auto"/);
});

void test("explore slide source exposes details and CTA controls", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExploreSlide.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="explore-open-details"/);
  assert.match(source, /data-testid="explore-view-details"/);
  assert.match(source, /data-testid="explore-share-action"/);
  assert.match(source, /SaveToggle/);
  assert.match(source, /TrustBadges/);
  assert.match(source, /ExploreDetailsSheet/);
  assert.match(source, /onGestureLockChange=\{onGestureLockChange\}/);
  assert.match(source, /h-9 w-9/);
});

void test("explore gallery source supports axis locking for horizontal gestures", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExploreGallery.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /resolveExploreGestureAxis/);
  assert.match(source, /onGestureLockChange\?\.\(horizontalLockActive\)/);
  assert.match(source, /data-testid="explore-gallery-gesture-layer"/);
  assert.match(source, /touchAction: horizontalLockActive \? "pan-x" : undefined/);
});

void test("explore details sheet source includes CTA that adapts by listing type", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExploreDetailsSheet.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /resolveExplorePrimaryAction/);
  assert.match(source, /data-testid="explore-primary-cta"/);
  assert.match(source, /data-testid="explore-view-full-details"/);
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
