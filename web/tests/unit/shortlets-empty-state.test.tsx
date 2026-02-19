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
  assert.ok(contents.includes("Try zooming out or clear the map area."));
  assert.ok(contents.includes("Try nearby areas or remove dates."));
});

void test("shortlets empty state exposes conversion actions", () => {
  const contents = fs.readFileSync(shellPath, "utf8");
  assert.ok(contents.includes("const clearDates = useCallback"));
  assert.ok(contents.includes("const onSearchNearby = useCallback"));
  assert.ok(contents.includes("const clearAdvancedFilters = useCallback"));
  assert.ok(contents.includes("Zoom out / clear map area"));
  assert.ok(contents.includes("Clear dates"));
  assert.ok(contents.includes("Search nearby"));
  assert.ok(contents.includes("Clear filters"));
});
