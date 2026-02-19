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

void test("shortlets shell closes drawer with escape key support", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("window.addEventListener(\"keydown\", onKeyDown)"));
  assert.ok(contents.includes("if (event.key === \"Escape\")"));
});

void test("shortlets shell exposes compact sticky pill summary controls", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes('data-testid="shortlets-compact-search-pill"'));
  assert.ok(contents.includes("showCompactSearch"));
  assert.ok(contents.includes("IntersectionObserver"));
  assert.ok(contents.includes('data-testid="shortlets-expanded-search-controls"'));
  assert.ok(contents.includes("whereSummary"));
  assert.ok(contents.includes("datesSummary"));
  assert.ok(contents.includes("guestsSummary"));
  assert.ok(contents.includes("shouldUseCompactShortletSearchPill(window.scrollY)"));
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
});

void test("shortlets shell heading copy follows destination-driven messaging", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  assert.ok(contents.includes("Find shortlets anywhere"));
  assert.ok(contents.includes("Find shortlets across Nigeria"));
  assert.ok(contents.includes("Find shortlets in ${activeDestination}"));
  assert.ok(contents.includes("Prices shown in {marketCurrency}"));
});
