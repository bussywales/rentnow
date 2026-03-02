import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { getExploreGestureLockSafetyTimeoutMs, shouldResetExploreGestureLock } from "@/components/explore/ExploreGallery";

void test("explore gesture lock reset helper includes touchend and touchcancel", () => {
  assert.equal(shouldResetExploreGestureLock("touchend"), true);
  assert.equal(shouldResetExploreGestureLock("touchcancel"), true);
  assert.equal(shouldResetExploreGestureLock("pointerup"), true);
  assert.equal(shouldResetExploreGestureLock("pointercancel"), true);
  assert.equal(shouldResetExploreGestureLock("touchmove"), false);
});

void test("explore gesture lock uses a safety timeout for iOS dropped-end-event resilience", () => {
  assert.equal(getExploreGestureLockSafetyTimeoutMs(), 600);
});

void test("explore gallery source binds touch end/cancel resets", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExploreGallery.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /onPointerUpCapture=\{resetGestureLock\}/);
  assert.match(source, /onPointerCancelCapture=\{resetGestureLock\}/);
  assert.match(source, /onTouchEndCapture=\{resetGestureLock\}/);
  assert.match(source, /onTouchCancelCapture=\{resetGestureLock\}/);
  assert.match(source, /onPointerLeave=\{resetGestureLock\}/);
  assert.match(source, /window\.addEventListener\("touchend"/);
  assert.match(source, /window\.addEventListener\("touchcancel"/);
  assert.match(source, /window\.addEventListener\("blur"/);
  assert.match(source, /document\.addEventListener\("visibilitychange"/);
  assert.match(source, /scheduleGestureLockSafetyReset/);
  assert.match(source, /window\.setTimeout\(\(\) => \{\s*resetGestureLock\(\);/);
  assert.match(source, /touchAction: canSwipeImages\s*\?\s*"pan-x pan-y pinch-zoom"\s*:\s*"pan-y pinch-zoom"/);
  assert.doesNotMatch(source, /horizontalLockActive\s*\?\s*"pan-x pinch-zoom"/);
});

void test("explore pager source always restores vertical paging lock state on reset paths", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExplorePager.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /<ExplorePagerV2/);
  assert.match(source, /setIsGestureLocked/);
  assert.match(source, /window\.addEventListener\("blur", resetGestureLock/);
  assert.match(source, /document\.addEventListener\("visibilitychange", resetGestureLockFromVisibility/);
});
