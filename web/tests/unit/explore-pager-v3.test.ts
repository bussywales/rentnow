import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  EXPLORE_PAGER_V3_AXIS_THRESHOLD_PX,
  EXPLORE_PAGER_V3_RESET_TIMEOUT_MS,
  resolveExplorePagerV3Axis,
  resolveExplorePagerV3Release,
  resolveExplorePagerV3Slots,
} from "@/components/explore/ExplorePagerV3";

void test("explore pager v3 axis resolver waits for threshold and identifies dominant axis", () => {
  assert.equal(resolveExplorePagerV3Axis(4, 5), null);
  assert.equal(resolveExplorePagerV3Axis(18, 7), "horizontal");
  assert.equal(resolveExplorePagerV3Axis(7, 18), "vertical");
  assert.equal(EXPLORE_PAGER_V3_AXIS_THRESHOLD_PX, 10);
});

void test("explore pager v3 keeps a fixed 3-slot buffer for prev/current/next", () => {
  const slots = resolveExplorePagerV3Slots(2, 8);
  assert.equal(slots.length, 3);
  assert.deepEqual(
    slots.map((slot) => slot.name),
    ["prev", "current", "next"]
  );
  assert.deepEqual(
    slots.map((slot) => slot.index),
    [1, 2, 3]
  );
});

void test("explore pager v3 release resolver allows advance when next listing exists, even with zero images", () => {
  const listings = [
    { id: "current", images: ["hero.jpg"] },
    { id: "next", images: [] },
  ];
  const result = resolveExplorePagerV3Release({
    activeIndex: 0,
    totalSlides: 2,
    deltaY: -220,
    velocityY: -0.25,
    viewportHeight: 780,
    canAdvanceToIndex: (index) => Boolean(listings[index]),
  });
  assert.equal(result.nextIndex, 1);
  assert.equal(result.blocked, false);
});

void test("explore pager v3 release resolver blocks advance when next listing is missing", () => {
  const listings = [{ id: "current", images: ["hero.jpg"] }];
  const result = resolveExplorePagerV3Release({
    activeIndex: 0,
    totalSlides: 2,
    deltaY: -220,
    velocityY: -0.25,
    viewportHeight: 780,
    canAdvanceToIndex: (index) => Boolean(listings[index]),
  });
  assert.equal(result.nextIndex, 0);
  assert.equal(result.blocked, true);
});

void test("explore pager v3 source uses stable slot keys and robust global reset paths", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExplorePagerV3.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="explore-pager-v3-track"/);
  assert.match(source, /resolveExplorePagerV3Slots/);
  assert.match(source, /key=\{slot\.name\}/);
  assert.match(source, /data-slot=\{slot\.name\}/);
  assert.match(source, /window\.addEventListener\("pointerup", finalizeGestureFromExitPath/);
  assert.match(source, /window\.addEventListener\("pointercancel", finalizeGestureFromExitPath/);
  assert.match(source, /window\.addEventListener\("touchend", finalizeGestureFromExitPath/);
  assert.match(source, /window\.addEventListener\("touchcancel", finalizeGestureFromExitPath/);
  assert.match(source, /window\.addEventListener\("blur", hardResetGestureState\)/);
  assert.match(source, /document\.addEventListener\("visibilitychange", resetFromVisibility/);
  assert.match(source, /touchAction: "pan-y pinch-zoom"/);
  assert.match(source, /EXPLORE_PAGER_V3_RESET_TIMEOUT_MS = 600/);
  assert.equal(EXPLORE_PAGER_V3_RESET_TIMEOUT_MS, 600);
});
