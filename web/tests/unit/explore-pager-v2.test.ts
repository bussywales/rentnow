import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  EXPLORE_PAGER_V2_AXIS_THRESHOLD_PX,
  EXPLORE_PAGER_V2_RESET_TIMEOUT_MS,
  resolveExplorePagerV2Axis,
  resolveExplorePagerV2NextIndex,
} from "@/components/explore/ExplorePagerV2";

void test("explore pager v2 axis resolver waits for threshold and identifies dominant axis", () => {
  assert.equal(resolveExplorePagerV2Axis(4, 5), null);
  assert.equal(resolveExplorePagerV2Axis(18, 7), "horizontal");
  assert.equal(resolveExplorePagerV2Axis(7, 18), "vertical");
  assert.equal(EXPLORE_PAGER_V2_AXIS_THRESHOLD_PX, 10);
});

void test("explore pager v2 snap resolver advances by distance", () => {
  assert.equal(
    resolveExplorePagerV2NextIndex({
      activeIndex: 2,
      totalSlides: 5,
      deltaY: -220,
      velocityY: -0.1,
      viewportHeight: 800,
    }),
    3
  );
  assert.equal(
    resolveExplorePagerV2NextIndex({
      activeIndex: 2,
      totalSlides: 5,
      deltaY: 220,
      velocityY: 0.1,
      viewportHeight: 800,
    }),
    1
  );
});

void test("explore pager v2 snap resolver advances by velocity and respects boundaries", () => {
  assert.equal(
    resolveExplorePagerV2NextIndex({
      activeIndex: 1,
      totalSlides: 4,
      deltaY: -12,
      velocityY: -0.8,
      viewportHeight: 900,
    }),
    2
  );
  assert.equal(
    resolveExplorePagerV2NextIndex({
      activeIndex: 0,
      totalSlides: 4,
      deltaY: 24,
      velocityY: 0.9,
      viewportHeight: 900,
    }),
    0
  );
  assert.equal(
    resolveExplorePagerV2NextIndex({
      activeIndex: 3,
      totalSlides: 4,
      deltaY: -24,
      velocityY: -0.9,
      viewportHeight: 900,
    }),
    3
  );
});

void test("explore pager v2 source keeps windowed 3-slide mounting and robust reset paths", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExplorePagerV2.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /const candidates = \[activeIndex - 1, activeIndex, activeIndex \+ 1\]/);
  assert.match(source, /data-testid="explore-pager-v2-track"/);
  assert.match(source, /translate3d\(0, \$\{offsetPx\}px, 0\)/);
  assert.match(source, /const hardResetGestureState = useCallback/);
  assert.match(source, /window\.addEventListener\("pointerup", resetFromGlobalExitPath/);
  assert.match(source, /window\.addEventListener\("pointercancel", resetFromGlobalExitPath/);
  assert.match(source, /window\.addEventListener\("touchend", resetFromGlobalExitPath/);
  assert.match(source, /window\.addEventListener\("touchcancel", resetFromGlobalExitPath/);
  assert.match(source, /window\.addEventListener\("blur", resetFromGlobalExitPath\)/);
  assert.match(source, /document\.addEventListener\("visibilitychange", resetFromVisibility/);
  assert.match(source, /onTouchEndCapture=\{resetFromExitPath\}/);
  assert.match(source, /onTouchCancelCapture=\{resetFromExitPath\}/);
  assert.match(source, /onPointerUpCapture=\{resetFromExitPath\}/);
  assert.match(source, /onPointerCancelCapture=\{resetFromExitPath\}/);
  assert.match(source, /EXPLORE_PAGER_V2_RESET_TIMEOUT_MS = 600/);
  assert.doesNotMatch(source, /if \(gestureLockedRef\.current\)/);
  assert.equal(EXPLORE_PAGER_V2_RESET_TIMEOUT_MS, 600);
});
