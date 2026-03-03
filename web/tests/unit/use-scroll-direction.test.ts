import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_SCROLL_COLLAPSE_THRESHOLD_PX,
  DEFAULT_SCROLL_EXPAND_THRESHOLD_PX,
  DEFAULT_SCROLL_NEAR_TOP_PX,
  resolveScrollDirection,
} from "@/lib/ui/useScrollDirection";

void test("useScrollDirection resolver returns down/up only after configured hysteresis thresholds", () => {
  assert.equal(
    resolveScrollDirection({
      previousY: 100,
      nextY: 116,
      previousDirection: "idle",
      collapseThresholdPx: 14,
      expandThresholdPx: 8,
      nearTopPx: 48,
    }),
    "down"
  );
  assert.equal(
    resolveScrollDirection({
      previousY: 220,
      nextY: 208,
      previousDirection: "down",
      collapseThresholdPx: 14,
      expandThresholdPx: 8,
      nearTopPx: 48,
    }),
    "up"
  );
  assert.equal(
    resolveScrollDirection({
      previousY: 210,
      nextY: 205,
      previousDirection: "down",
      collapseThresholdPx: 14,
      expandThresholdPx: 8,
      nearTopPx: 48,
    }),
    "down"
  );
  assert.equal(
    resolveScrollDirection({
      previousY: 50,
      nextY: 20,
      previousDirection: "down",
      collapseThresholdPx: 14,
      expandThresholdPx: 8,
      nearTopPx: 48,
    }),
    "up"
  );
});

void test("useScrollDirection exports conservative defaults for mobile dock behaviour", () => {
  assert.equal(DEFAULT_SCROLL_COLLAPSE_THRESHOLD_PX, 14);
  assert.equal(DEFAULT_SCROLL_EXPAND_THRESHOLD_PX, 8);
  assert.equal(DEFAULT_SCROLL_NEAR_TOP_PX, 48);
});

void test("useScrollDirection source uses passive scroll listener and rAF throttling", () => {
  const sourcePath = path.join(process.cwd(), "lib", "ui", "useScrollDirection.ts");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /window\.addEventListener\("scroll", onScroll, \{ passive: true \}\)/);
  assert.match(source, /rafRef\.current = window\.requestAnimationFrame\(applyScrollFrame\)/);
  assert.match(source, /window\.cancelAnimationFrame\(rafRef\.current\)/);
});
