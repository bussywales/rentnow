import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveExploreGestureAxis } from "@/components/explore/ExploreGallery";

void test("explore gallery resolves horizontal swipe intent when dx dominates", () => {
  assert.equal(resolveExploreGestureAxis(24, 4), "horizontal");
  assert.equal(resolveExploreGestureAxis(-28, 6), "horizontal");
});

void test("explore gallery keeps gesture undecided under threshold", () => {
  assert.equal(resolveExploreGestureAxis(4, 4), null);
});

void test("unified carousel source exposes horizontal touch + overflow classes", () => {
  const sourcePath = path.join(process.cwd(), "components", "ui", "UnifiedImageCarousel.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /overflow-x-auto overflow-y-hidden/);
  assert.match(source, /touch-pan-x/);
  assert.match(source, /snap-x snap-mandatory/);
  assert.match(source, /basis-full snap-start/);
});
