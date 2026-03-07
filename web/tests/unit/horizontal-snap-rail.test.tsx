import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("horizontal snap rail enforces containment and scoped horizontal scrolling", () => {
  const sourcePath = path.join(process.cwd(), "components", "ui", "HorizontalSnapRail.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /w-full min-w-0 max-w-full overflow-x-clip/);
  assert.match(source, /overflow-x-auto overscroll-x-contain/);
  assert.match(source, /-webkit-overflow-scrolling:touch/);
  assert.match(source, /flex w-max min-w-full max-w-full snap-x snap-mandatory gap-3/);
});
