import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const stickyBarPath = path.join(
  process.cwd(),
  "components",
  "shortlets",
  "search",
  "ShortletsMobileStickyBar.tsx"
);
const shellPath = path.join(process.cwd(), "components", "shortlets", "search", "ShortletsSearchShell.tsx");

void test("collapsed sticky variant exposes chip testids and routes to existing handlers", () => {
  const contents = fs.readFileSync(stickyBarPath, "utf8");

  assert.ok(contents.includes('data-testid="shortlets-sticky-collapsed"'));
  assert.ok(contents.includes('data-testid="shortlets-sticky-chip-where"'));
  assert.ok(contents.includes('data-testid="shortlets-sticky-chip-dates"'));
  assert.ok(contents.includes('data-testid="shortlets-sticky-chip-guests"'));
  assert.ok(contents.includes('data-testid="shortlets-sticky-chip-filters"'));
  assert.ok(contents.includes('onFocusExpandedControl("where")'));
  assert.ok(contents.includes('onFocusExpandedControl("checkIn")'));
  assert.ok(contents.includes('onFocusExpandedControl("guests")'));
  assert.ok(contents.includes("onOpenFiltersDrawer"));
});

void test("sticky bar keeps both collapsed and expanded variants with reduced-motion-safe transitions", () => {
  const contents = fs.readFileSync(stickyBarPath, "utf8");

  assert.ok(contents.includes('data-testid="shortlets-sticky-expanded"'));
  assert.ok(contents.includes('data-testid="shortlets-sticky-collapsed"'));
  assert.ok(contents.includes("isCollapsed ?"));
  assert.ok(contents.includes("motion-reduce:transition-none"));
});

void test("shortlets shell passes collapse state into sticky bar and keeps compact visibility contract", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("showCompactSearch={showCompactSearch}"));
  assert.ok(contents.includes("isCollapsed={isStickyCollapsed}"));
  assert.ok(contents.includes("lockExpanded: mobileMapOpen || filtersOpen || quickFiltersPanelOpen || searchDatesOpen"));
  assert.ok(contents.includes("forceExpandStickyBar();"));
  assert.ok(contents.includes("onFocusExpandedControl={focusStickyControl}"));
  assert.ok(contents.includes("resolveShortletSearchControlVisibility"));
});
