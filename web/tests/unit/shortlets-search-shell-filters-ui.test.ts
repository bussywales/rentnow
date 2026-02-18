import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const shellPath = path.join(process.cwd(), "components", "shortlets", "search", "ShortletsSearchShell.tsx");

void test("shortlets shell renders a filters drawer with apply and clear actions", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes('data-testid="shortlets-filters-button"'));
  assert.ok(contents.includes('data-testid="shortlets-filters-overlay"'));
  assert.ok(contents.includes('data-testid="shortlets-filters-drawer"'));
  assert.ok(contents.includes("Apply"));
  assert.ok(contents.includes("Clear all"));
  assert.ok(contents.includes("setFiltersOpen(false)"));
});

void test("shortlets shell quick filters are constrained to a single horizontal row", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes('data-testid="shortlets-quick-filters"'));
  assert.ok(contents.includes("overflow-x-auto whitespace-nowrap"));
  assert.ok(contents.includes("shrink-0 rounded-full border"));
});

void test("shortlets shell supports active filter summary with overflow collapse", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes('data-testid="shortlets-active-filter-summary"'));
  assert.ok(contents.includes("+{hiddenFilterTagCount} more"));
  assert.ok(contents.includes("removeShortletAdvancedFilterTag"));
});

void test("shortlets shell closes drawer with escape key support", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("window.addEventListener(\"keydown\", onKeyDown)"));
  assert.ok(contents.includes("if (event.key === \"Escape\")"));
});
