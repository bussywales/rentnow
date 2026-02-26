import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("mobile quick start bar mounts bottom-sheet trigger and sheet component", () => {
  const sourcePath = path.join(process.cwd(), "components", "home", "MobileQuickStartBar.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="mobile-quickstart-search-trigger"/);
  assert.match(source, /setSearchOpen\(true\)/);
  assert.match(source, /useMarketPreference/);
  assert.match(source, /aria-haspopup="dialog"/);
  assert.match(source, /aria-expanded=\{searchOpen\}/);
  assert.match(source, /aria-controls=\{quickSearchSheetId\}/);
  assert.match(
    source,
    /<MobileQuickSearchSheet[\s\S]*sheetId=\{quickSearchSheetId\}[\s\S]*\/>/
  );
});

void test("mobile quick search sheet source contains category and preset rails", () => {
  const sourcePath = path.join(process.cwd(), "components", "home", "MobileQuickSearchSheet.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /from \"@\/lib\/home\/mobile-featured-discovery\"/);
  assert.match(source, /data-testid="mobile-quicksearch-sheet"/);
  assert.match(source, /data-testid="mobile-quicksearch-intent-rail"/);
  assert.match(source, /data-testid={`mobile-quicksearch-intent-\$\{option\.key\}`}/);
  assert.match(source, /data-testid={`mobile-quicksearch-category-\$\{option\.key\}`}/);
  assert.match(source, /data-testid="mobile-quicksearch-presets"/);
  assert.match(source, /data-testid={`mobile-quicksearch-preset-\$\{preset\.id\}`}/);
  assert.match(source, /data-testid="mobile-quicksearch-dates"/);
  assert.match(source, /mobile-quicksearch-date-this-weekend/);
  assert.match(source, /mobile-quicksearch-date-next-weekend/);
  assert.match(source, /mobile-quicksearch-date-flexible/);
  assert.match(source, /data-testid="mobile-quicksearch-guests"/);
  assert.match(source, /data-testid="mobile-quicksearch-guests-increment"/);
  assert.match(source, /data-testid="mobile-quicksearch-guests-value"/);
  assert.match(source, /data-testid="mobile-quicksearch-location-input"/);
  assert.match(source, /data-testid="mobile-quicksearch-search"/);
  assert.match(source, /data-testid="mobile-quicksearch-shortlets"/);
  assert.match(source, /<BottomSheet/);
  assert.match(source, /sheetId=\{sheetId\}/);
  assert.match(source, /setCategory\(option\.key\)/);
  assert.match(source, /setActivePresetId\(null\)/);
  assert.match(source, /setCategory\(preset\.category\)/);
  assert.match(source, /setActivePresetId\(preset\.id\)/);
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
  assert.match(source, /router\.push\(searchHref\)/);
  assert.doesNotMatch(source, /window\.location\.assign\(searchHref\)/);
  assert.doesNotMatch(source, /export function buildMobileQuickSearchHref/);
  assert.match(source, /intent: activeIntent/);
  assert.match(source, /guests: guestsDraft/);
  assert.match(source, /checkIn: checkInDraft/);
  assert.match(source, /checkOut: checkOutDraft/);
  assert.match(source, /onOpenChange\(false\)/);
  assert.match(source, /<BottomSheet/);
  assert.match(source, /setSelectedShortletParams\(preset\.shortletParams \?\? null\)/);
});

void test("mobile quick search sheet source wires recents list, clear action, and storage helper", () => {
  const sourcePath = path.join(process.cwd(), "components", "home", "MobileQuickSearchSheet.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /getRecentSearches\(/);
  assert.match(source, /pushRecentSearch\(/);
  assert.match(source, /clearRecentSearches\(/);
  assert.match(source, /getRecentFeaturedTaps\(/);
  assert.match(source, /mergeRecentSearchesWithFeaturedTaps\(/);
  assert.match(source, /clearRecentFeaturedTaps\(/);
  assert.match(source, /data-testid="mobile-quicksearch-recents"/);
  assert.match(source, /data-testid="mobile-quicksearch-recent-item"/);
  assert.match(source, /data-testid="mobile-quicksearch-recents-clear"/);
  assert.match(source, /data-testid="mobile-quicksearch-empty-suggestions"/);
  assert.match(source, /data-testid="mobile-quicksearch-empty-suggestion"/);
  assert.match(source, /data-testid="mobile-quicksearch-use-last-search"/);
  assert.match(source, /DATE_PICK_TEST_IDS/);
  assert.match(source, /mobile-quicksearch-date-this-weekend/);
  assert.match(source, /mobile-quicksearch-date-next-weekend/);
  assert.match(source, /mobile-quicksearch-date-flexible/);
  assert.match(source, /getMarketSearchTerminology/);
  assert.match(source, /getLastSearchHref/);
  assert.match(source, /getLastBrowseUrl/);
});
