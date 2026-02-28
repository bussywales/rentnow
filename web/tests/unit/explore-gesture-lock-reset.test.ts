import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { shouldResetExploreGestureLock } from "@/components/explore/ExploreGallery";

void test("explore gesture lock reset helper includes touchend and touchcancel", () => {
  assert.equal(shouldResetExploreGestureLock("touchend"), true);
  assert.equal(shouldResetExploreGestureLock("touchcancel"), true);
  assert.equal(shouldResetExploreGestureLock("pointerup"), true);
  assert.equal(shouldResetExploreGestureLock("pointercancel"), true);
  assert.equal(shouldResetExploreGestureLock("touchmove"), false);
});

void test("explore gallery source binds touch end/cancel resets", () => {
  const sourcePath = path.join(process.cwd(), "components", "explore", "ExploreGallery.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /onTouchEndCapture=\{clearGesture\}/);
  assert.match(source, /onTouchCancelCapture=\{clearGesture\}/);
  assert.match(source, /window\.addEventListener\("touchend"/);
  assert.match(source, /window\.addEventListener\("touchcancel"/);
});
