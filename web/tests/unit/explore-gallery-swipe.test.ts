import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  getExploreGestureLockSafetyTimeoutMs,
  resolveExploreGestureAxis,
  shouldResetExploreGestureLock,
} from "@/components/explore/ExploreGallery";

void test("explore gallery resolves horizontal swipe intent when dx dominates", () => {
  assert.equal(resolveExploreGestureAxis(24, 4), "horizontal");
  assert.equal(resolveExploreGestureAxis(-28, 6), "horizontal");
});

void test("explore gallery keeps gesture undecided under threshold", () => {
  assert.equal(resolveExploreGestureAxis(4, 4), null);
});

void test("explore gesture lock resets on touch and pointer completion events", () => {
  assert.equal(shouldResetExploreGestureLock("touchend"), true);
  assert.equal(shouldResetExploreGestureLock("touchcancel"), true);
  assert.equal(shouldResetExploreGestureLock("pointerup"), true);
  assert.equal(shouldResetExploreGestureLock("pointercancel"), true);
  assert.equal(shouldResetExploreGestureLock("touchmove"), false);
});

void test("explore gallery gesture lock safety timeout stays fixed for iOS fallback reset", () => {
  assert.equal(getExploreGestureLockSafetyTimeoutMs(), 600);
});

void test("unified carousel source keeps iOS vertical pan enabled in the image region", () => {
  const sourcePath = path.join(process.cwd(), "components", "ui", "UnifiedImageCarousel.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /"h-full overflow-hidden overscroll-x-contain"/);
  assert.match(source, /style=\{\{ touchAction: "pan-y pinch-zoom" \}\}/);
  assert.match(source, /data-testid=\{`\$\{rootTestId\}-viewport`\}/);
  assert.match(source, /data-testid=\{`\$\{rootTestId\}-track`\}/);
  assert.match(source, /snap-x snap-mandatory/);
  assert.match(source, /w-full flex-none snap-start/);
  assert.doesNotMatch(source, /overflow-x-scroll overflow-y-hidden/);
  assert.doesNotMatch(source, /touch-pan-x/);
  assert.match(source, /watchDrag: allowDrag/);
});

void test("explore gallery source does not block horizontal drag with touch preventDefault", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExploreGallery.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /onTouchMoveCapture=\{handleTouchMoveCapture\}/);
  assert.match(source, /if \(gestureAxisRef\.current === "horizontal"\) \{\s*scheduleGestureLockSafetyReset\(\);/);
  assert.match(source, /window\.setTimeout\(\(\) => \{\s*resetGestureLock\(\);/);
  assert.match(source, /progressiveUpgradeOnIdle=\{shouldConserveDataState && canSwipeImages\}/);
  assert.match(source, /maxConcurrentImageLoads=\{maxConcurrentImageLoads\}/);
  assert.match(source, /showLoadingCue=\{slideDistance === 0\}/);
  assert.doesNotMatch(source, /event\.preventDefault\(\)/);
});
