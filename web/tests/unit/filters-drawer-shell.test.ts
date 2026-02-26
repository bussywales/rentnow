import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const sourcePath = path.join(process.cwd(), "components", "filters", "FilterDrawerShell.tsx");

void test("shared filter drawer shell exposes consistent overlay, drawer, and action testids", () => {
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid=\{overlayTestId\}/);
  assert.match(source, /data-testid=\{drawerTestId\}/);
  assert.match(source, /data-testid="filters-clear"/);
  assert.match(source, /data-testid="filters-reset"/);
  assert.match(source, /data-testid="filters-apply"/);
});

void test("shared filter drawer shell keeps mobile bottom-sheet plus desktop side-panel layout", () => {
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /fixed inset-0 z-50 flex items-end/);
  assert.match(source, /md:items-stretch md:justify-end/);
  assert.match(source, /max-h-\[86vh\]/);
  assert.match(source, /md:w-\[420px\]/);
  assert.match(source, /sticky bottom-0/);
});
