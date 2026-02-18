import type { ShortletSearchBounds } from "@/lib/shortlet/search";

export type ShortletMapSearchAreaState = {
  activeBounds: ShortletSearchBounds | null;
  draftBounds: ShortletSearchBounds | null;
  mapDirty: boolean;
};

export type ShortletMapAutoFitInput = {
  hasMarkers: boolean;
  hasAutoFitOnce: boolean;
  resultHash: string;
  lastResultHash: string | null;
  hasUserMovedMap: boolean;
  fitRequestKey: string;
  lastFitRequestKey: string | null;
};

function boundsEqual(left: ShortletSearchBounds | null, right: ShortletSearchBounds | null): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return (
    left.north === right.north &&
    left.south === right.south &&
    left.east === right.east &&
    left.west === right.west
  );
}

export function createShortletMapSearchAreaState(
  activeBounds: ShortletSearchBounds | null
): ShortletMapSearchAreaState {
  return {
    activeBounds,
    draftBounds: activeBounds,
    mapDirty: false,
  };
}

export function applyMapViewportChange(
  current: ShortletMapSearchAreaState,
  nextBounds: ShortletSearchBounds
): ShortletMapSearchAreaState {
  if (!current.activeBounds && !current.draftBounds) {
    return {
      activeBounds: nextBounds,
      draftBounds: nextBounds,
      mapDirty: false,
    };
  }
  if (boundsEqual(current.activeBounds, nextBounds) || boundsEqual(current.draftBounds, nextBounds)) {
    return current;
  }
  return {
    activeBounds: current.activeBounds,
    draftBounds: nextBounds,
    mapDirty: true,
  };
}

export function applySearchThisArea(
  current: ShortletMapSearchAreaState
): ShortletMapSearchAreaState {
  if (!current.mapDirty) return current;
  return {
    activeBounds: current.draftBounds,
    draftBounds: current.draftBounds,
    mapDirty: false,
  };
}

export function resolveSelectedListingId(
  current: string | null,
  input: { pinId?: string | null; cardId?: string | null }
): string | null {
  const pin = String(input.pinId || "").trim();
  if (pin) return pin;
  const card = String(input.cardId || "").trim();
  if (card) return card;
  return current;
}

export function toggleShortletSearchView(current: "list" | "map"): "list" | "map" {
  return current === "map" ? "list" : "map";
}

export function shouldAutoFitShortletMap(input: ShortletMapAutoFitInput): boolean {
  if (!input.hasMarkers) return false;
  if (input.resultHash === input.lastResultHash) return false;
  if (!input.hasAutoFitOnce) return true;

  const explicitSearch =
    input.lastFitRequestKey === null || input.fitRequestKey !== input.lastFitRequestKey;

  if (explicitSearch) return true;

  return !input.hasUserMovedMap;
}
