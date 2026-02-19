import test from "node:test";
import assert from "node:assert/strict";
import {
  clearMapListHover,
  createMapListCouplingState,
  setMapListHover,
  setMapListSelected,
  shouldSoftPanHoveredMarker,
  shouldScrollCardIntoView,
} from "@/lib/shortlet/map-list-coupling";

void test("map list coupling updates hover and selected from list/map sources", () => {
  const initial = createMapListCouplingState(null);
  const hovered = setMapListHover(initial, "listing-1", "list");
  assert.equal(hovered.hoverId, "listing-1");
  assert.equal(hovered.source, "list");

  const selected = setMapListSelected(hovered, "listing-2", "map");
  assert.equal(selected.selectedId, "listing-2");
  assert.equal(selected.hoverId, "listing-2");
  assert.equal(selected.source, "map");

  const cleared = clearMapListHover(selected);
  assert.equal(cleared.hoverId, null);
  assert.equal(cleared.selectedId, "listing-2");
});

void test("marker-driven selection should trigger card scroll", () => {
  assert.equal(
    shouldScrollCardIntoView({
      source: "map",
      selectedId: "listing-1",
    }),
    true
  );
  assert.equal(
    shouldScrollCardIntoView({
      source: "list",
      selectedId: "listing-1",
    }),
    false
  );
});

void test("hover soft-pan only runs for new out-of-viewport markers", () => {
  assert.equal(
    shouldSoftPanHoveredMarker({
      hoveredListingId: "listing-1",
      lastHoveredListingId: null,
      isInsidePaddedViewport: false,
    }),
    true
  );
  assert.equal(
    shouldSoftPanHoveredMarker({
      hoveredListingId: "listing-1",
      lastHoveredListingId: "listing-1",
      isInsidePaddedViewport: false,
    }),
    false
  );
  assert.equal(
    shouldSoftPanHoveredMarker({
      hoveredListingId: "listing-2",
      lastHoveredListingId: "listing-1",
      isInsidePaddedViewport: true,
    }),
    false
  );
});
