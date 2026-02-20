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
  assert.ok(contents.includes("Free cancellation"));
  assert.ok(contents.includes("freeCancellation"));
  assert.ok(contents.includes("View options"));
  assert.ok(contents.includes("Display total price"));
  assert.ok(contents.includes("Search as I move the map"));
  assert.ok(contents.includes("Saved only"));
});

void test("shortlets shell quick filters are constrained to a single horizontal row", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes('data-testid="shortlets-quick-filters"'));
  assert.ok(contents.includes("overflow-hidden whitespace-nowrap"));
  assert.ok(contents.includes('data-testid="shortlets-quick-filters-button"'));
  assert.ok(contents.includes('data-testid="shortlets-quick-filters-popover"'));
  assert.ok(contents.includes("quickFiltersCollapsed ?"));
});

void test("shortlets shell supports active filter summary with overflow collapse", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes('data-testid="shortlets-active-filter-summary"'));
  assert.ok(contents.includes("+{hiddenFilterTagCount} more"));
  assert.ok(contents.includes("overflow-hidden whitespace-nowrap"));
  assert.ok(contents.includes("removeShortletAdvancedFilterTag"));
});

void test("shortlets shell supports saved-only view toggle and friendly empty state actions", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes('data-testid="shortlets-saved-toggle"'));
  assert.ok(contents.includes("writeShortletSavedViewParam"));
  assert.ok(contents.includes("No saved stays yet."));
  assert.ok(contents.includes("Browse stays"));
  assert.ok(contents.includes("Search Nigeria"));
  assert.ok(contents.includes('data-testid="shortlets-saved-toast"'));
});

void test("shortlets shell closes drawer with escape key support", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("window.addEventListener(\"keydown\", onKeyDown)"));
  assert.ok(contents.includes("if (event.key === \"Escape\")"));
});

void test("shortlets shell uses premium date-range picker controls instead of native date inputs", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.equal(contents.includes('type="date"'), false);
  assert.ok(contents.includes('data-testid="shortlets-date-range-trigger"'));
  assert.ok(contents.includes('data-testid="shortlets-date-range-popover"'));
  assert.ok(contents.includes('data-testid="shortlets-date-range-sheet"'));
  assert.ok(contents.includes("Apply dates"));
  assert.ok(contents.includes("clearSearchDateRangeDraft"));
  assert.ok(contents.includes("Calendar"));
});

void test("shortlets shell prevents invalid date ranges before search submit", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("hasInvalidDateDraft"));
  assert.ok(contents.includes("checkInDraft >= checkOutDraft"));
  assert.ok(contents.includes("Choose a valid check-in and check-out range."));
  assert.ok(contents.includes("openSearchDatePicker()"));
});

void test("shortlets shell exposes compact sticky pill summary controls", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes('data-testid="shortlets-compact-search-pill"'));
  assert.ok(contents.includes("resolveShortletSearchControlVisibility"));
  assert.ok(contents.includes('data-active="true"'));
  assert.ok(contents.includes('data-active={showExpandedSearch ? "true" : "false"}'));
  assert.ok(contents.includes('{ inert: "" } as Record<string, string>'));
  assert.ok(contents.includes("showCompactSearch"));
  assert.ok(contents.includes("showExpandedSearch"));
  assert.ok(contents.includes('data-testid="shortlets-expanded-search-controls"'));
  assert.ok(contents.includes("whereSummary"));
  assert.ok(contents.includes("datesSummary"));
  assert.ok(contents.includes("guestsSummary"));
  assert.equal(contents.includes('data-testid="shortlets-price-display-toggle-compact"'), false);
  assert.ok(contents.includes("shouldUseCompactShortletSearchPill(window.scrollY)"));
  assert.ok(contents.includes('<option value="price_asc">Price low-high</option>'));
  assert.ok(contents.includes('<option value="price_desc">Price high-low</option>'));
  assert.ok(contents.includes('<option value="rating">Rating</option>'));
});

void test("price display toggle is URL-driven and disabled until dates are selected", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("parsePriceDisplayParam"));
  assert.ok(contents.includes("formatPriceDisplayParam"));
  assert.ok(contents.includes("isTotalPriceEnabled"));
  assert.ok(contents.includes('data-testid="shortlets-price-display-toggle"'));
  assert.ok(contents.includes('data-testid="shortlets-price-display-helper"'));
  assert.ok(contents.includes("Select dates to see total price."));
  assert.ok(contents.includes('next.set("priceDisplay", formatPriceDisplayParam(enabled ? "total" : "nightly"))'));
  assert.ok(contents.includes("priceDisplay: parsePriceDisplayParam(searchParams.get(\"priceDisplay\"))"));
});

void test("guests control always renders readable guest labels", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("formatShortletGuestsLabel"));
  assert.ok(contents.includes('aria-label="Guests"'));
  assert.ok(contents.includes("guests-option-"));
  assert.equal(contents.includes('type="number"'), false);
});

void test("map camera intent only updates on explicit search actions", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("cameraIntentNonce"));
  assert.ok(contents.includes("resolveShortletMapCameraIntent"));
  assert.ok(contents.includes("hasBoundsChanged: true"));
  assert.ok(contents.includes("hasLocationChanged: queryDraft.trim() !== parsedUi.where.trim()"));
  assert.ok(contents.includes("resolvedFitRequestKey={resolvedMapFitRequestKey}"));
});

void test("mobile map toggle and list layout avoid covering listing actions", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("space-y-3 pb-20 lg:hidden"));
  assert.ok(contents.includes("fixed bottom-5 left-1/2"));
  assert.ok(contents.includes("-translate-x-1/2"));
});

void test("desktop list grid adapts when map panel is open or hidden", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("const [desktopMapOpen, setDesktopMapOpen] = useState(true)"));
  assert.ok(contents.includes('data-testid="shortlets-desktop-map-toggle"'));
  assert.ok(contents.includes("desktopCardsGridClass"));
  assert.ok(contents.includes("[grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]"));
  assert.ok(contents.includes("[grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]"));
  assert.ok(contents.includes('data-testid="shortlets-desktop-results-grid"'));
  assert.ok(contents.includes("prioritizeFirstImage={index < 2}"));
  assert.ok(contents.includes("prioritizeFirstImage={index < 1}"));
});

void test("shortlets shell heading copy follows destination-driven messaging", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("Find shortlets anywhere"));
  assert.ok(contents.includes("Find shortlets across Nigeria"));
  assert.ok(contents.includes("Find shortlets in ${activeDestination}"));
  assert.ok(contents.includes("pricingContextCopy"));
  assert.ok(contents.includes("Prices vary by listing."));
  assert.ok(contents.includes("Prices shown in ${marketCurrency}. Market changes pricing context, not destination."));
});

void test("shortlets shell uses where typeahead with recent and saved search hooks", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("WhereTypeahead"));
  assert.ok(contents.includes("recentSearches"));
  assert.ok(contents.includes("savedSearches"));
  assert.ok(contents.includes("onSelectWhereSuggestion"));
  assert.ok(contents.includes("onApplySearchPreset"));
});

void test("shortlets shell carries selected dates into property detail links", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("const buildPropertyHref"));
  assert.ok(contents.includes('params.set("checkIn", parsedUi.checkIn)'));
  assert.ok(contents.includes('params.set("checkOut", parsedUi.checkOut)'));
  assert.ok(contents.includes('params.set("guests", parsedUi.guests)'));
  assert.ok(contents.includes('params.set("back", `/shortlets?${backLinkQuery}`)'));
});

void test("shortlets shell normalizes derivative image fields for map and list payloads", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("thumbImageUrl"));
  assert.ok(contents.includes("cardImageUrl"));
  assert.ok(contents.includes("heroImageUrl"));
  assert.ok(contents.includes("mapPreviewImageUrl"));
});

void test("shortlets shell result summary reflects bbox-applied map-area state", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("isShortletBboxApplied"));
  assert.ok(contents.includes("resolveShortletResultsLabel"));
  assert.ok(contents.includes("resolveShortletPendingMapAreaLabel"));
  assert.ok(contents.includes("isBboxApplied"));
  assert.ok(contents.includes("pendingMapAreaLabel"));
  assert.ok(contents.includes('data-testid="shortlets-results-label"'));
  assert.ok(contents.includes("Clear map area"));
  assert.ok(contents.includes('data-testid="shortlets-clear-map-area"'));
  assert.ok(contents.includes("showExploreMapHint"));
  assert.ok(contents.includes("Explore the map, then use Search this area."));
});

void test("shortlets shell supports opt-in map move search toggle", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("Search as I move the map"));
  assert.ok(contents.includes('data-testid="shortlets-map-move-toggle"'));
  assert.ok(contents.includes("mapMoveSearchMode"));
  assert.ok(contents.includes("mapMoveDebounceRef"));
  assert.ok(contents.includes("mapAuto"));
  assert.ok(contents.includes("showDelayedUpdatingIndicator"));
  assert.ok(contents.includes("Refreshing map results…"));
});

void test("map move search auto mode writes bbox and triggers URL refresh path", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("if (mapMoveSearchMode === \"auto\")"));
  assert.ok(contents.includes("setMapMoveUpdating(true)"));
  assert.ok(contents.includes("serializeShortletSearchBbox(nextBounds)"));
  assert.ok(contents.includes("writeShortletMapMoveSearchMode(next, \"auto\")"));
  assert.ok(contents.includes("updateUrl((next) => {"));
  assert.ok(contents.includes("preserveExplicitShortletMarketParam"));
});

void test("map move search manual mode keeps search-this-area flow", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("applyMapViewportChange(current, nextBounds)"));
  assert.ok(contents.includes("!isMapMoveSearchEnabled && searchAreaDirty"));
  assert.ok(contents.includes("onSearchThisArea"));
});

void test("mobile map overlay renders full-screen structure with explicit height and close controls", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes('data-testid="shortlets-mobile-map"'));
  assert.ok(contents.includes("fixed inset-0 z-40"));
  assert.ok(contents.includes('id="shortlets-mobile-map-modal"'));
  assert.ok(contents.includes('role="dialog"'));
  assert.ok(contents.includes('aria-modal="true"'));
  assert.ok(contents.includes('data-testid="shortlets-shell-background"'));
  assert.ok(contents.includes('{ inert: "" } as Record<string, string>'));
  assert.ok(contents.includes('data-testid="shortlets-open-map"'));
  assert.ok(contents.includes('aria-haspopup="dialog"'));
  assert.ok(contents.includes('aria-controls="shortlets-mobile-map-modal"'));
  assert.ok(contents.includes('ref={mobileMapPrimaryActionRef}'));
  assert.ok(contents.includes('style={{ height: "calc(100vh - 84px)" }}'));
  assert.ok(contents.includes('aria-label="Close map"'));
  assert.ok(contents.includes("Back to results"));
  assert.ok(contents.includes("mobileListScrollYRef.current = window.scrollY"));
  assert.ok(contents.includes("window.scrollTo({ top: mobileListScrollYRef.current, behavior: \"auto\" })"));
  assert.ok(contents.includes("document.body.style.overflow = \"hidden\""));
  assert.ok(contents.includes("focusableSelector"));
  assert.ok(contents.includes("if (event.key !== \"Tab\")"));
  assert.ok(contents.includes("if (event.key === \"Escape\")"));
  assert.ok(contents.includes("mobileMapRestoreFocusRef"));
});

void test("desktop loading keeps stable container and shows refresh skeleton while fetching", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("min-h-[420px]"));
  assert.ok(contents.includes('data-testid="shortlets-desktop-loading-skeleton"'));
  assert.ok(contents.includes('data-testid="shortlets-desktop-refresh-skeleton"'));
});

void test("map bbox URL updates use replace semantics without pushing history", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })"));
});

void test("shortlets shell does not silently inject market during unrelated URL updates", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("preserveExplicitShortletMarketParam"));
  assert.equal(contents.includes('if (!next.get("market")) next.set("market", parsedUi.market);'), false);
});
