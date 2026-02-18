import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMapViewportChange,
  applySearchThisArea,
  createDefaultShortletAdvancedFilters,
  createShortletMapSearchAreaState,
  listShortletActiveFilterTags,
  readShortletAdvancedFiltersFromParams,
  removeShortletAdvancedFilterTag,
  resolveShortletMapMarkerVisualState,
  resolveSelectedListingId,
  shouldUseCompactShortletSearchPill,
  shouldAutoFitShortletMap,
  toggleShortletSearchView,
  writeShortletAdvancedFiltersToParams,
} from "@/lib/shortlet/search-ui-state";

void test("map move marks area dirty but does not auto-apply bounds", () => {
  const initial = createShortletMapSearchAreaState({
    north: 6.65,
    south: 6.35,
    east: 3.6,
    west: 3.2,
  });
  const moved = applyMapViewportChange(initial, {
    north: 6.72,
    south: 6.4,
    east: 3.72,
    west: 3.3,
  });

  assert.equal(moved.mapDirty, true);
  assert.deepEqual(moved.activeBounds, initial.activeBounds);
});

void test("search this area applies draft bounds and clears dirty flag", () => {
  const moved = applyMapViewportChange(
    createShortletMapSearchAreaState({
      north: 6.65,
      south: 6.35,
      east: 3.6,
      west: 3.2,
    }),
    {
      north: 6.74,
      south: 6.42,
      east: 3.78,
      west: 3.34,
    }
  );
  const applied = applySearchThisArea(moved);

  assert.equal(applied.mapDirty, false);
  assert.deepEqual(applied.activeBounds, {
    north: 6.74,
    south: 6.42,
    east: 3.78,
    west: 3.34,
  });
});

void test("selection state links pin and card interactions", () => {
  const fromPin = resolveSelectedListingId(null, { pinId: "listing-1" });
  assert.equal(fromPin, "listing-1");

  const fromCard = resolveSelectedListingId("listing-1", { cardId: "listing-2" });
  assert.equal(fromCard, "listing-2");
});

void test("mobile map toggle flips view between list and map", () => {
  assert.equal(toggleShortletSearchView("list"), "map");
  assert.equal(toggleShortletSearchView("map"), "list");
});

void test("auto-fit runs on first load and explicit search changes", () => {
  assert.equal(
    shouldAutoFitShortletMap({
      hasMarkers: true,
      hasAutoFitOnce: false,
      resultHash: "ng|2|a,b",
      lastResultHash: null,
      hasUserMovedMap: false,
      fitRequestKey: "market=NG",
      lastFitRequestKey: null,
    }),
    true
  );

  assert.equal(
    shouldAutoFitShortletMap({
      hasMarkers: true,
      hasAutoFitOnce: true,
      resultHash: "ng|3|a,b,c",
      lastResultHash: "ng|2|a,b",
      hasUserMovedMap: true,
      fitRequestKey: "market=NG&bounds=1,2,3,4",
      lastFitRequestKey: "market=NG",
    }),
    true
  );
});

void test("auto-fit skips unchanged result sets and non-explicit interactions", () => {
  assert.equal(
    shouldAutoFitShortletMap({
      hasMarkers: true,
      hasAutoFitOnce: true,
      resultHash: "ng|2|a,b",
      lastResultHash: "ng|2|a,b",
      hasUserMovedMap: false,
      fitRequestKey: "market=NG",
      lastFitRequestKey: "market=NG",
    }),
    false
  );

  assert.equal(
    shouldAutoFitShortletMap({
      hasMarkers: true,
      hasAutoFitOnce: true,
      resultHash: "ng|3|a,b,c",
      lastResultHash: "ng|2|a,b",
      hasUserMovedMap: true,
      fitRequestKey: "market=NG",
      lastFitRequestKey: "market=NG",
    }),
    false
  );
});

void test("advanced filters can round-trip through URL search params", () => {
  const params = new URLSearchParams("q=ikeja");
  const nextFilters = createDefaultShortletAdvancedFilters();
  nextFilters.powerBackup = true;
  nextFilters.bookingMode = "request";

  writeShortletAdvancedFiltersToParams(params, nextFilters);
  const parsed = readShortletAdvancedFiltersFromParams(params);

  assert.equal(parsed.powerBackup, true);
  assert.equal(parsed.bookingMode, "request");
  assert.equal(params.get("powerBackup"), "1");
  assert.equal(params.get("bookingMode"), "request");
});

void test("remove filter tag clears only the selected URL param", () => {
  const params = new URLSearchParams(
    "powerBackup=1&bookingMode=instant&waterBorehole=1"
  );

  removeShortletAdvancedFilterTag(params, {
    id: "bookingMode",
    label: "Instant book",
    param: "bookingMode",
    value: "instant",
  });

  assert.equal(params.has("bookingMode"), false);
  assert.equal(params.get("powerBackup"), "1");
  assert.equal(params.get("waterBorehole"), "1");
});

void test("active filter tags expose trust filters and booking mode labels", () => {
  const tags = listShortletActiveFilterTags({
    powerBackup: true,
    waterBorehole: false,
    security: false,
    wifi: true,
    verifiedHost: true,
    bookingMode: "instant",
  });

  assert.deepEqual(
    tags.map((tag) => tag.label),
    ["Power backup", "Wi-Fi", "Verified host", "Instant book"]
  );
});

void test("compact sticky pill toggles when scroll crosses threshold", () => {
  assert.equal(shouldUseCompactShortletSearchPill(0), false);
  assert.equal(shouldUseCompactShortletSearchPill(120), true);
  assert.equal(shouldUseCompactShortletSearchPill(90, 120), false);
  assert.equal(shouldUseCompactShortletSearchPill(121, 120), true);
});

void test("map marker state prioritizes selected over hovered", () => {
  assert.deepEqual(
    resolveShortletMapMarkerVisualState({
      listingId: "a",
      selectedListingId: "a",
      hoveredListingId: "a",
    }),
    { mode: "selected", emphasized: true, zIndexOffset: 2000 }
  );

  assert.deepEqual(
    resolveShortletMapMarkerVisualState({
      listingId: "b",
      selectedListingId: "a",
      hoveredListingId: "b",
    }),
    { mode: "hovered", emphasized: true, zIndexOffset: 1000 }
  );

  assert.deepEqual(
    resolveShortletMapMarkerVisualState({
      listingId: "c",
      selectedListingId: "a",
      hoveredListingId: "b",
    }),
    { mode: "default", emphasized: false, zIndexOffset: 0 }
  );
});
