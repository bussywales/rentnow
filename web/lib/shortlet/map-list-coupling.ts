export type MapListSource = "list" | "map" | null;

export type MapListCouplingState = {
  hoverId: string | null;
  selectedId: string | null;
  source: MapListSource;
};

export function createMapListCouplingState(selectedId: string | null = null): MapListCouplingState {
  return {
    hoverId: null,
    selectedId,
    source: null,
  };
}

function normalizeId(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

export function setMapListHover(
  state: MapListCouplingState,
  id: string | null,
  source: Exclude<MapListSource, null>
): MapListCouplingState {
  return {
    ...state,
    hoverId: normalizeId(id),
    source,
  };
}

export function clearMapListHover(state: MapListCouplingState): MapListCouplingState {
  if (!state.hoverId) return state;
  return {
    ...state,
    hoverId: null,
  };
}

export function setMapListSelected(
  state: MapListCouplingState,
  id: string | null,
  source: Exclude<MapListSource, null>
): MapListCouplingState {
  const selectedId = normalizeId(id) ?? state.selectedId;
  return {
    ...state,
    selectedId,
    source,
    hoverId: selectedId,
  };
}

export function shouldScrollCardIntoView(input: {
  source: MapListSource;
  selectedId: string | null;
}): boolean {
  return input.source === "map" && !!input.selectedId;
}

export function shouldSoftPanHoveredMarker(input: {
  hoveredListingId: string | null;
  lastHoveredListingId: string | null;
  isInsidePaddedViewport: boolean;
}): boolean {
  if (!input.hoveredListingId) return false;
  if (input.hoveredListingId === input.lastHoveredListingId) return false;
  if (input.isInsidePaddedViewport) return false;
  return true;
}
