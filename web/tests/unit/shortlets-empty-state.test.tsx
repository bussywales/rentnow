import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const shellPath = path.join(
  process.cwd(),
  "components",
  "shortlets",
  "search",
  "ShortletsSearchShell.tsx"
);

void test("shortlets empty state messaging adapts to bbox and destination", () => {
  const contents = fs.readFileSync(shellPath, "utf8");
  assert.ok(contents.includes("No stays in this map area."));
  assert.ok(contents.includes("No stays found in ${activeDestination}."));
  assert.ok(contents.includes("Try zooming out or Search this area"));
  assert.ok(contents.includes("Try nearby areas or remove dates."));
});

void test("shortlets empty state exposes clear actions", () => {
  const contents = fs.readFileSync(shellPath, "utf8");
  assert.ok(contents.includes("const clearDates = useCallback"));
  assert.ok(contents.includes("const clearAdvancedFilters = useCallback"));
  assert.ok(contents.includes("Clear dates"));
  assert.ok(contents.includes("Clear filters"));
});
