import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMapViewportChange,
  applySearchThisArea,
  createDefaultShortletAdvancedFilters,
  createShortletMapSearchAreaState,
  formatShortletGuestsLabel,
  isShortletBboxApplied,
  isShortletMapMoveSearchEnabled,
  isShortletSavedViewEnabled,
  listShortletActiveFilterTags,
  normalizeShortletGuestsParam,
  parseShortletMapMoveSearchMode,
  readShortletAdvancedFiltersFromParams,
  resolveShortletPendingMapAreaLabel,
  resolveShortletResultsLabel,
  removeShortletAdvancedFilterTag,
  resolveShortletMapCameraIntent,
  resolveShortletMapMarkerVisualState,
  resolveSelectedListingId,
  shouldUseCompactShortletSearchPill,
  shouldAutoFitShortletMap,
  toggleShortletSearchView,
  writeShortletMapMoveSearchMode,
  writeShortletSavedViewParam,
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

void test("auto-fit runs on initial intent and explicit search results", () => {
  assert.equal(
    shouldAutoFitShortletMap({
      hasMarkers: true,
      cameraIntent: "initial",
      cameraIntentNonce: 1,
      resolvedFitRequestKey: "market=NG",
      activeFitRequestKey: "market=NG",
      resultHash: "ng|2|a,b",
      lastFittedResultHash: null,
    }),
    true
  );

  assert.equal(
    shouldAutoFitShortletMap({
      hasMarkers: true,
      cameraIntent: "user_search",
      cameraIntentNonce: 2,
      resolvedFitRequestKey: "market=NG&q=ikeja",
      activeFitRequestKey: "market=NG&q=ikeja",
      resultHash: "ng|3|a,b,c",
      lastFittedResultHash: "ng|2|a,b",
    }),
    true
  );
});

void test("auto-fit skips unchanged results, idle intent, and unresolved fetches", () => {
  assert.equal(
    shouldAutoFitShortletMap({
      hasMarkers: true,
      cameraIntent: "user_search",
      cameraIntentNonce: 3,
      resolvedFitRequestKey: "market=NG&q=ikeja",
      activeFitRequestKey: "market=NG&q=ikeja",
      resultHash: "ng|2|a,b",
      lastFittedResultHash: "ng|2|a,b",
    }),
    false
  );

  assert.equal(
    shouldAutoFitShortletMap({
      hasMarkers: true,
      cameraIntent: "idle",
      cameraIntentNonce: 4,
      resolvedFitRequestKey: "market=NG&q=ikeja",
      activeFitRequestKey: "market=NG&q=ikeja",
      resultHash: "ng|3|a,b,c",
      lastFittedResultHash: "ng|2|a,b",
    }),
    false
  );

  assert.equal(
    shouldAutoFitShortletMap({
      hasMarkers: true,
      cameraIntent: "location_change",
      cameraIntentNonce: 5,
      resolvedFitRequestKey: "market=NG&q=lekki",
      activeFitRequestKey: "market=NG&q=yaba",
      resultHash: "ng|3|a,b,c",
      lastFittedResultHash: "ng|2|a,b",
    }),
    false
  );
});

void test("camera intent resolver maps explicit user actions", () => {
  assert.equal(
    resolveShortletMapCameraIntent({
      hasLocationChanged: false,
      hasBoundsChanged: true,
    }),
    "user_search_area"
  );
  assert.equal(
    resolveShortletMapCameraIntent({
      hasLocationChanged: true,
      hasBoundsChanged: false,
    }),
    "location_change"
  );
  assert.equal(
    resolveShortletMapCameraIntent({
      hasLocationChanged: false,
      hasBoundsChanged: false,
    }),
    "user_search"
  );
});

void test("advanced filters can round-trip through URL search params", () => {
  const params = new URLSearchParams("q=ikeja");
  const nextFilters = createDefaultShortletAdvancedFilters();
  nextFilters.powerBackup = true;
  nextFilters.bookingMode = "request";
  nextFilters.freeCancellation = true;

  writeShortletAdvancedFiltersToParams(params, nextFilters);
  const parsed = readShortletAdvancedFiltersFromParams(params);

  assert.equal(parsed.powerBackup, true);
  assert.equal(parsed.bookingMode, "request");
  assert.equal(parsed.freeCancellation, true);
  assert.equal(params.get("powerBackup"), "1");
  assert.equal(params.get("bookingMode"), "request");
  assert.equal(params.get("freeCancellation"), "1");
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
    freeCancellation: true,
    bookingMode: "instant",
  });

  assert.deepEqual(
    tags.map((tag) => tag.label),
    ["Power backup", "Wi-Fi", "Verified host", "Instant book", "Free cancellation"]
  );
});

void test("compact sticky pill toggles when scroll crosses threshold", () => {
  assert.equal(shouldUseCompactShortletSearchPill(0), false);
  assert.equal(shouldUseCompactShortletSearchPill(120), true);
  assert.equal(shouldUseCompactShortletSearchPill(90, 120), false);
  assert.equal(shouldUseCompactShortletSearchPill(121, 120), true);
});

void test("guests helpers normalize URL params and generate clear labels", () => {
  assert.equal(normalizeShortletGuestsParam(undefined), 1);
  assert.equal(normalizeShortletGuestsParam(""), 1);
  assert.equal(normalizeShortletGuestsParam("0"), 1);
  assert.equal(normalizeShortletGuestsParam("2.9"), 2);
  assert.equal(formatShortletGuestsLabel(1), "1 guest");
  assert.equal(formatShortletGuestsLabel(3), "3 guests");
  assert.equal(formatShortletGuestsLabel("4"), "4 guests");
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

void test("bbox applied helper only marks valid bbox values as applied", () => {
  assert.equal(isShortletBboxApplied(null), false);
  assert.equal(isShortletBboxApplied(""), false);
  assert.equal(isShortletBboxApplied("7.7,9.0,7.9,9.2"), true);
  assert.equal(isShortletBboxApplied("bad"), false);
  assert.equal(isShortletBboxApplied("8,8,7,7"), false);
});

void test("results label reflects whether map area is applied", () => {
  assert.equal(resolveShortletResultsLabel({ total: 8, isBboxApplied: false }), "8 stays found");
  assert.equal(
    resolveShortletResultsLabel({ total: 3, isBboxApplied: true }),
    "3 stays within map area"
  );
});

void test("pending map area label appears only when map bounds changed", () => {
  assert.equal(resolveShortletPendingMapAreaLabel(true), "Showing all results — Search this area to update.");
  assert.equal(resolveShortletPendingMapAreaLabel(false), null);
});

void test("map move search mode parser handles auto/manual safely", () => {
  assert.equal(parseShortletMapMoveSearchMode("1"), "auto");
  assert.equal(parseShortletMapMoveSearchMode("true"), "auto");
  assert.equal(parseShortletMapMoveSearchMode("0"), "manual");
  assert.equal(parseShortletMapMoveSearchMode(null), "manual");
  assert.equal(isShortletMapMoveSearchEnabled("1"), true);
  assert.equal(isShortletMapMoveSearchEnabled(undefined), false);
});

void test("map move search mode writes URL params for auto and manual modes", () => {
  const params = new URLSearchParams("where=abuja");
  writeShortletMapMoveSearchMode(params, "auto");
  assert.equal(params.get("mapAuto"), "1");

  writeShortletMapMoveSearchMode(params, "manual");
  assert.equal(params.has("mapAuto"), false);
});

void test("saved view helpers parse and write URL param safely", () => {
  const params = new URLSearchParams("where=lagos");

  assert.equal(isShortletSavedViewEnabled(null), false);
  assert.equal(isShortletSavedViewEnabled("0"), false);
  assert.equal(isShortletSavedViewEnabled("1"), true);
  assert.equal(isShortletSavedViewEnabled("true"), true);

  writeShortletSavedViewParam(params, true);
  assert.equal(params.get("saved"), "1");

  writeShortletSavedViewParam(params, false);
  assert.equal(params.has("saved"), false);
});
