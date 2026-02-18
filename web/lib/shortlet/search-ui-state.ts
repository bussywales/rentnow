import type { ShortletSearchBounds } from "@/lib/shortlet/search";

export type ShortletMapSearchAreaState = {
  activeBounds: ShortletSearchBounds | null;
  draftBounds: ShortletSearchBounds | null;
  mapDirty: boolean;
};

export type ShortletMapAutoFitInput = {
  hasMarkers: boolean;
  cameraIntent: "initial" | "idle" | "user_search" | "user_search_area" | "location_change";
  cameraIntentNonce: number;
  resolvedFitRequestKey: string;
  activeFitRequestKey: string;
  resultHash: string;
  lastFittedResultHash: string | null;
};

export type ShortletMapMarkerVisualState = {
  mode: "default" | "hovered" | "selected";
  emphasized: boolean;
  zIndexOffset: number;
};

export type ShortletBookingModeFilter = "" | "instant" | "request";

export type ShortletAdvancedFilterState = {
  powerBackup: boolean;
  waterBorehole: boolean;
  security: boolean;
  wifi: boolean;
  verifiedHost: boolean;
  bookingMode: ShortletBookingModeFilter;
};

export type ShortletActiveFilterTag = {
  id: string;
  label: string;
  param: string;
  value: string | null;
};

export const SHORTLET_QUICK_FILTER_KEYS = ["powerBackup", "waterBorehole", "security"] as const;

const TRUST_FILTER_LABELS: Record<
  Exclude<keyof ShortletAdvancedFilterState, "bookingMode">,
  string
> = {
  powerBackup: "Power backup",
  waterBorehole: "Borehole water",
  security: "Security / gated",
  wifi: "Wi-Fi",
  verifiedHost: "Verified host",
};

export function createDefaultShortletAdvancedFilters(): ShortletAdvancedFilterState {
  return {
    powerBackup: false,
    waterBorehole: false,
    security: false,
    wifi: false,
    verifiedHost: false,
    bookingMode: "",
  };
}

function parseBoolFlag(value: string | null): boolean {
  return value === "1";
}

export function readShortletAdvancedFiltersFromParams(
  params: URLSearchParams
): ShortletAdvancedFilterState {
  return {
    powerBackup: parseBoolFlag(params.get("powerBackup")),
    waterBorehole: parseBoolFlag(params.get("waterBorehole")),
    security: parseBoolFlag(params.get("security")),
    wifi: parseBoolFlag(params.get("wifi")),
    verifiedHost: parseBoolFlag(params.get("verifiedHost")),
    bookingMode:
      params.get("bookingMode") === "instant" || params.get("bookingMode") === "request"
        ? (params.get("bookingMode") as ShortletBookingModeFilter)
        : "",
  };
}

export function writeShortletAdvancedFiltersToParams(
  params: URLSearchParams,
  filters: ShortletAdvancedFilterState
): void {
  const trustKeys = Object.keys(TRUST_FILTER_LABELS) as Array<keyof typeof TRUST_FILTER_LABELS>;
  for (const key of trustKeys) {
    if (filters[key]) params.set(key, "1");
    else params.delete(key);
  }
  if (filters.bookingMode) params.set("bookingMode", filters.bookingMode);
  else params.delete("bookingMode");
}

export function removeShortletAdvancedFilterTag(
  params: URLSearchParams,
  tag: Pick<ShortletActiveFilterTag, "param">
): void {
  params.delete(tag.param);
}

export function listShortletActiveFilterTags(
  filters: ShortletAdvancedFilterState
): ShortletActiveFilterTag[] {
  const tags: ShortletActiveFilterTag[] = [];
  for (const [key, label] of Object.entries(TRUST_FILTER_LABELS) as Array<
    [keyof typeof TRUST_FILTER_LABELS, string]
  >) {
    if (filters[key]) {
      tags.push({
        id: key,
        label,
        param: key,
        value: "1",
      });
    }
  }

  if (filters.bookingMode === "instant") {
    tags.push({
      id: "bookingMode",
      label: "Instant book",
      param: "bookingMode",
      value: "instant",
    });
  }
  if (filters.bookingMode === "request") {
    tags.push({
      id: "bookingMode",
      label: "Request to book",
      param: "bookingMode",
      value: "request",
    });
  }

  return tags;
}

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
  if (input.cameraIntent === "idle") return false;
  if (input.cameraIntentNonce <= 0) return false;
  if (input.resolvedFitRequestKey !== input.activeFitRequestKey) return false;
  if (input.cameraIntent === "initial") return true;
  if (input.resultHash === input.lastFittedResultHash) return false;
  return true;
}

export function resolveShortletMapCameraIntent(input: {
  hasLocationChanged: boolean;
  hasBoundsChanged: boolean;
}): "user_search" | "user_search_area" | "location_change" {
  if (input.hasBoundsChanged) return "user_search_area";
  if (input.hasLocationChanged) return "location_change";
  return "user_search";
}

export function shouldUseCompactShortletSearchPill(scrollY: number, thresholdPx = 96): boolean {
  if (!Number.isFinite(scrollY)) return false;
  return scrollY > thresholdPx;
}

export function normalizeShortletGuestsParam(value: string | null | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.max(1, Math.trunc(parsed));
}

export function formatShortletGuestsLabel(
  value: number | string | null | undefined
): string {
  const guests = normalizeShortletGuestsParam(value == null ? null : String(value));
  return `${guests} ${guests === 1 ? "guest" : "guests"}`;
}

export function resolveShortletMapMarkerVisualState(input: {
  listingId: string;
  selectedListingId: string | null;
  hoveredListingId: string | null;
}): ShortletMapMarkerVisualState {
  if (input.selectedListingId === input.listingId) {
    return { mode: "selected", emphasized: true, zIndexOffset: 2000 };
  }
  if (input.hoveredListingId === input.listingId) {
    return { mode: "hovered", emphasized: true, zIndexOffset: 1000 };
  }
  return { mode: "default", emphasized: false, zIndexOffset: 0 };
}
