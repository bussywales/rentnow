import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MobileQuickSearchSheet } from "@/components/home/MobileQuickSearchSheet";

void test("mobile quick start bar mounts bottom-sheet trigger and sheet component", () => {
  const sourcePath = path.join(process.cwd(), "components", "home", "MobileQuickStartBar.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="mobile-quickstart-search-trigger"/);
  assert.match(source, /setSearchOpen\(true\)/);
  assert.match(source, /<MobileQuickSearchSheet open=\{searchOpen\} onOpenChange=\{setSearchOpen\} \/>/);
});

void test("mobile quick search sheet renders intent chips and actions", () => {
  const html = renderToStaticMarkup(
    React.createElement(MobileQuickSearchSheet, {
      open: true,
      onOpenChange: () => {},
    })
  );

  assert.match(html, /data-testid="mobile-quicksearch-sheet"/);
  assert.match(html, /data-testid="mobile-quicksearch-category-rent"/);
  assert.match(html, /data-testid="mobile-quicksearch-category-buy"/);
  assert.match(html, /data-testid="mobile-quicksearch-category-shortlet"/);
  assert.match(html, /data-testid="mobile-quicksearch-category-off_plan"/);
  assert.match(html, /data-testid="mobile-quicksearch-category-all"/);
  assert.match(html, /data-testid="mobile-quicksearch-presets"/);
  assert.match(html, /data-testid="mobile-quicksearch-location-input"/);
  assert.match(html, /data-testid="mobile-quicksearch-search"/);
  assert.match(html, /data-testid="mobile-quicksearch-shortlets"/);
  assert.match(html, /data-testid="bottom-sheet"/);
});

void test("mobile quick search sheet source closes and navigates on search submit", () => {
  const sourcePath = path.join(process.cwd(), "components", "home", "MobileQuickSearchSheet.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /onSubmit=\{\(event\) =>/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /type="submit"/);
  assert.match(source, /mobile-quicksearch-category-rail/);
  assert.match(source, /mobile-quicksearch-presets/);
  assert.match(source, /mobile-quicksearch-preset-/);
  assert.match(source, /window\.location\.assign\(searchHref\)/);
  assert.match(source, /onOpenChange\(false\)/);
  assert.match(source, /<BottomSheet/);
});

void test("mobile quick search sheet source wires recents list, clear action, and storage helper", () => {
  const sourcePath = path.join(process.cwd(), "components", "home", "MobileQuickSearchSheet.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /getRecentSearches\(/);
  assert.match(source, /pushRecentSearch\(/);
  assert.match(source, /clearRecentSearches\(/);
  assert.match(source, /data-testid="mobile-quicksearch-recents"/);
  assert.match(source, /data-testid="mobile-quicksearch-recent-item"/);
  assert.match(source, /data-testid="mobile-quicksearch-recents-clear"/);
});
