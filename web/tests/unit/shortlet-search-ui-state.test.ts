import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMapViewportChange,
  applySearchThisArea,
  createShortletMapSearchAreaState,
  resolveSelectedListingId,
  shouldAutoFitShortletMap,
  toggleShortletSearchView,
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
