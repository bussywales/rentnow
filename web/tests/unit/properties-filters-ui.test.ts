import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const panelPath = path.join(process.cwd(), "components", "properties", "AdvancedSearchPanel.tsx");
const pagePath = path.join(process.cwd(), "app", "properties", "page.tsx");

void test("properties advanced search uses shared drawer shell with apply/reset/clear semantics", () => {
  const source = fs.readFileSync(panelPath, "utf8");

  assert.match(source, /data-testid="properties-filters-button"/);
  assert.match(source, /data-testid="properties-filters-active-indicator"/);
  assert.match(source, /aria-haspopup="dialog"/);
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /aria-controls=\{drawerId\}/);
  assert.match(source, /<FilterDrawerShell/);
  assert.match(source, /drawerTestId="properties-filters-drawer"/);
  assert.match(source, /overlayTestId="properties-filters-overlay"/);
  assert.match(source, /dialogId=\{drawerId\}/);
  assert.match(source, /onApply=\{onApply\}/);
  assert.match(source, /onReset=\{onReset\}/);
  assert.match(source, /onClear=\{onClear\}/);
  assert.match(source, /createApplyAndCloseAction/);
  assert.match(source, /createResetDraftAction/);
  assert.match(source, /createClearApplyAndCloseAction/);
});

void test("properties page uses shared filter chip row preview", () => {
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /<FilterChipRow/);
  assert.match(source, /testId="properties-active-filter-summary"/);
  assert.match(source, /clearHref="\/properties"/);
  assert.match(source, /clearLabel="Clear"/);
});
