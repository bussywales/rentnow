import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizePriceDraftValue } from "@/components/properties/AdvancedSearchPanel";

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
  assert.match(source, /data-testid="advanced-commercial-layout-type"/);
  assert.match(source, /data-testid="advanced-enclosed-rooms-min"/);
  assert.match(
    source,
    /Commercial search uses layout, enclosed rooms, bathrooms, and floor size more/
  );
});

void test("properties page uses shared filter chip row preview", () => {
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /<FilterChipRow/);
  assert.match(source, /testId="properties-active-filter-summary"/);
  assert.match(source, /clearHref="\/properties"/);
  assert.match(source, /clearLabel="Clear"/);
});

void test("price draft normalization preserves multi-digit numbers while stripping non-digits", () => {
  assert.equal(normalizePriceDraftValue("250000"), "250000");
  assert.equal(normalizePriceDraftValue("25,000,000"), "25000000");
  assert.equal(normalizePriceDraftValue("12a34"), "1234");
  assert.equal(normalizePriceDraftValue(""), "");
});

void test("properties advanced search price inputs use text fields with numeric keyboard hints", () => {
  const source = fs.readFileSync(panelPath, "utf8");

  assert.match(source, /export function normalizePriceDraftValue/);
  assert.match(source, /<span>Price min<\/span>/);
  assert.match(source, /<span>Price max<\/span>/);
  assert.match(source, /data-testid="advanced-min-price"/);
  assert.match(source, /data-testid="advanced-max-price"/);
  assert.match(source, /inputMode="numeric"/);
  assert.match(source, /pattern="\[0-9\]\*"/);
  assert.match(source, /minPrice: normalizePriceDraftValue\(event\.target\.value\)/);
  assert.match(source, /maxPrice: normalizePriceDraftValue\(event\.target\.value\)/);
  assert.match(source, /toNumberOrNull\(nextDraft\.minPrice\)/);
  assert.match(source, /toNumberOrNull\(nextDraft\.maxPrice\)/);
});
