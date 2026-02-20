"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import type { Property } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Calendar } from "@/components/ui/calendar";
import { PropertyCardSkeleton } from "@/components/properties/PropertyCardSkeleton";
import { ShortletsSearchMap } from "@/components/shortlets/search/ShortletsSearchMap";
import { ShortletsSearchListCard } from "@/components/shortlets/search/ShortletsSearchListCard";
import { WhereTypeahead, type WhereSuggestion } from "@/components/shortlets/search/WhereTypeahead";
import {
  isNigeriaDestinationQuery,
  parseSearchView,
  parseShortletSearchBbox,
  parseShortletSearchBounds,
  serializeShortletSearchBbox,
  type ShortletSearchBounds,
} from "@/lib/shortlet/search";
import { fromDateKey, toDateKey } from "@/lib/shortlet/availability";
import {
  applyMapViewportChange,
  applySearchThisArea,
  createDefaultShortletAdvancedFilters,
  createShortletMapSearchAreaState,
  formatPriceDisplayParam,
  formatShortletGuestsLabel,
  isShortletMapMoveSearchEnabled,
  isTotalPriceEnabled,
  listShortletActiveFilterTags,
  normalizeShortletGuestsParam,
  parsePriceDisplayParam,
  preserveExplicitShortletMarketParam,
  readShortletAdvancedFiltersFromParams,
  resolveShortletPendingMapAreaLabel,
  resolveShortletResultsLabel,
  resolveShortletSearchControlVisibility,
  removeShortletAdvancedFilterTag,
  resolveShortletMapCameraIntent,
  isShortletBboxApplied,
  isShortletSavedViewEnabled,
  shouldUseCompactShortletSearchPill,
  SHORTLET_QUICK_FILTER_KEYS,
  toggleShortletSearchView,
  writeShortletMapMoveSearchMode,
  writeShortletSavedViewParam,
  type ShortletAdvancedFilterState,
  type ShortletMapMoveSearchMode,
  writeShortletAdvancedFiltersToParams,
} from "@/lib/shortlet/search-ui-state";
import { resolveShortletBookingMode, resolveShortletNightlyPriceMinor } from "@/lib/shortlet/discovery";
import {
  addRecentSearchPreset,
  buildShortletPresetLabel,
  clearRecentSearchPresets,
  createPresetParamsFromSearchParams,
  presetParamsToSearchParams,
  readRecentSearchPresets,
  readSavedSearchPresets,
  removeSavedSearchPreset,
  saveSearchPreset,
  type ShortletSearchPreset,
} from "@/lib/shortlet/search-presets";
import {
  clearMapListHover,
  createMapListCouplingState,
  setMapListHover,
  setMapListSelected,
  shouldScrollCardIntoView,
  type MapListCouplingState,
} from "@/lib/shortlet/map-list-coupling";
import { getSavedIds, toggleSaved } from "@/lib/shortlet/saved.client";

type SearchItem = Property & {
  primaryImageUrl?: string | null;
  mapPreviewImageUrl?: string | null;
  coverImageUrl?: string | null;
  imageCount?: number;
  imageUrls?: string[];
  verifiedHost?: boolean;
  cancellationPolicy?: "flexible_24h" | "flexible_48h" | "moderate_5d" | "strict";
  cancellationLabel?: string;
  freeCancellation?: boolean;
  nightlyPrice?: number | null;
  nightlyPriceMinor?: number | null;
  pricingMode?: "nightly" | "price_on_request";
  nights?: number | null;
  subtotal?: number | null;
  fees?: {
    serviceFee?: number | null;
    cleaningFee?: number | null;
    taxes?: number | null;
  } | null;
  total?: number | null;
  feeTotal?: number | null;
  feesIncluded?: boolean;
};

type SearchResponse = {
  ok: boolean;
  page: number;
  pageSize: number;
  total: number;
  items: SearchItem[];
  mapItems?: Array<{
    id: string;
    title: string;
    city: string;
    currency: string;
    nightlyPriceMinor: number | null;
    pricingMode?: "nightly" | "price_on_request";
    bookingMode?: "instant" | "request";
    primaryImageUrl: string | null;
    mapPreviewImageUrl?: string | null;
    latitude: number | null;
    longitude: number | null;
  }>;
  nearbyAlternatives: Array<{ label: string; hint: string }>;
};

type ShortletSortOption = "recommended" | "price_asc" | "price_desc" | "rating" | "newest";

type Props = {
  initialSearchParams?: Record<string, string | string[] | undefined>;
};

type TrustFilterKey =
  | "powerBackup"
  | "waterBorehole"
  | "security"
  | "wifi"
  | "verifiedHost";

const TRUST_FILTERS: Array<{ key: TrustFilterKey; label: string }> = [
  { key: "powerBackup", label: "Power backup" },
  { key: "waterBorehole", label: "Borehole water" },
  { key: "security", label: "Security / gated" },
  { key: "wifi", label: "Wi-Fi" },
  { key: "verifiedHost", label: "Verified host" },
];

const QUICK_FILTERS = TRUST_FILTERS.filter((item) =>
  SHORTLET_QUICK_FILTER_KEYS.includes(item.key as (typeof SHORTLET_QUICK_FILTER_KEYS)[number])
);

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  if (typeof value === "string") return value;
  return null;
}

function normalizeShortletSortParam(value: string | null): ShortletSortOption {
  if (value === "price_low" || value === "price_asc") return "price_asc";
  if (value === "price_high" || value === "price_desc") return "price_desc";
  if (value === "rating") return "rating";
  if (value === "newest") return "newest";
  return "recommended";
}

function readQueryParamsFromSearchParams(searchParams: URLSearchParams) {
  const market = (searchParams.get("market") ?? "NG").trim().toUpperCase();
  const guests = normalizeShortletGuestsParam(searchParams.get("guests"));
  const where = searchParams.get("where") ?? searchParams.get("q") ?? "";
  const placeId = searchParams.get("placeId") ?? "";
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  return {
    where,
    placeId,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    checkIn: searchParams.get("checkIn") ?? "",
    checkOut: searchParams.get("checkOut") ?? "",
    guests: String(guests),
    market: /^[A-Z]{2}$/.test(market) ? market : "NG",
    sort: normalizeShortletSortParam(searchParams.get("sort")),
    priceDisplay: parsePriceDisplayParam(searchParams.get("priceDisplay")),
    bookingMode: searchParams.get("bookingMode") ?? "",
    mapAutoSearch: isShortletMapMoveSearchEnabled(searchParams.get("mapAuto")),
    view: parseSearchView(searchParams.get("view")),
  };
}

function createSearchParamsFromInitial(initial: Props["initialSearchParams"]): URLSearchParams {
  const next = new URLSearchParams();
  if (!initial) return next;
  for (const [key, value] of Object.entries(initial)) {
    const normalized = firstValue(value);
    if (normalized) next.set(key, normalized);
  }
  return next;
}

function formatMoney(currency: string, nightlyMinor: number | null): string {
  if (typeof nightlyMinor !== "number" || nightlyMinor <= 0) return "Price on request";
  const major = nightlyMinor / 100;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 0,
    }).format(major);
  } catch {
    return `${currency || "NGN"} ${major.toFixed(0)}`;
  }
}

function formatCompactDate(dateValue: string): string {
  if (!dateValue) return "";
  const parsed = Date.parse(`${dateValue}T00:00:00.000Z`);
  if (!Number.isFinite(parsed)) return dateValue;
  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    day: "numeric",
  }).format(new Date(parsed));
}

function createDateRangeFromDraftValues(checkIn: string, checkOut: string): DateRange | undefined {
  const from = fromDateKey(checkIn);
  const to = fromDateKey(checkOut);
  if (!from) return undefined;
  if (!to) return { from, to: undefined };
  if (toDateKey(from) >= toDateKey(to)) return { from, to: undefined };
  return { from, to };
}

function hasCompleteValidDateRange(
  range: DateRange | undefined
): range is DateRange & { from: Date; to: Date } {
  if (!range?.from || !range.to) return false;
  return toDateKey(range.from) < toDateKey(range.to);
}

function getMarketCurrency(countryCode: string): string {
  if (countryCode === "NG") return "NGN";
  if (countryCode === "GB") return "GBP";
  if (countryCode === "KE") return "KES";
  if (countryCode === "US") return "USD";
  return "NGN";
}

function clampLatitude(value: number): number {
  return Math.max(-85, Math.min(85, value));
}

function clampLongitude(value: number): number {
  if (value > 180) return 180;
  if (value < -180) return -180;
  return value;
}

function buildNearbySearchBbox(lat: number, lng: number): string {
  const latDelta = 0.2;
  const lngDelta = Math.max(0.2, 0.2 / Math.cos((lat * Math.PI) / 180));
  const bounds: ShortletSearchBounds = {
    south: clampLatitude(lat - latDelta),
    north: clampLatitude(lat + latDelta),
    west: clampLongitude(lng - lngDelta),
    east: clampLongitude(lng + lngDelta),
  };
  return serializeShortletSearchBbox(bounds) ?? "";
}

function normalizeSearchItemImageFields(item: SearchItem): SearchItem {
  const primaryImageUrl = item.primaryImageUrl ?? null;
  const mapPreviewImageUrl = item.mapPreviewImageUrl ?? primaryImageUrl;
  const coverImageUrl = item.coverImageUrl ?? item.cover_image_url ?? primaryImageUrl;
  const images =
    item.images ??
    (item.imageUrls ?? []).map((imageUrl, index) => ({
      id: `${item.id}-image-${index}`,
      image_url: imageUrl,
    }));

  return {
    ...item,
    primaryImageUrl,
    mapPreviewImageUrl,
    cover_image_url: coverImageUrl,
    images,
  };
}

export function ShortletsSearchShell({ initialSearchParams }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialParams = useMemo(
    () => createSearchParamsFromInitial(initialSearchParams),
    [initialSearchParams]
  );
  const effectiveSearchParams = searchParams ?? initialParams;
  const searchParamsKey = effectiveSearchParams.toString();
  const stableSearchParams = useMemo(() => new URLSearchParams(searchParamsKey), [searchParamsKey]);
  const parsedUi = useMemo(
    () => readQueryParamsFromSearchParams(stableSearchParams),
    [stableSearchParams]
  );
  const parsedBounds = useMemo(
    () =>
      parseShortletSearchBbox(stableSearchParams.get("bbox")) ??
      parseShortletSearchBounds(stableSearchParams.get("bounds")),
    [stableSearchParams]
  );
  const requestSearchParams = useMemo(() => {
    const next = new URLSearchParams(stableSearchParams.toString());
    next.delete("view");
    preserveExplicitShortletMarketParam({
      nextParams: next,
      sourceParams: stableSearchParams,
    });
    if (!next.get("page")) next.set("page", "1");
    if (!next.get("pageSize")) next.set("pageSize", "24");
    return next;
  }, [stableSearchParams]);
  const requestSearchQuery = requestSearchParams.toString();
  const mapFitRequestKey = useMemo(() => {
    const next = new URLSearchParams(requestSearchQuery);
    next.delete("page");
    next.delete("pageSize");
    return next.toString();
  }, [requestSearchQuery]);
  const backLinkQuery = useMemo(() => {
    const next = new URLSearchParams(searchParamsKey);
    preserveExplicitShortletMarketParam({
      nextParams: next,
      sourceParams: stableSearchParams,
    });
    return next.toString();
  }, [searchParamsKey, stableSearchParams]);
  const buildPropertyHref = useCallback(
    (propertyId: string) => {
      const params = new URLSearchParams();
      params.set("back", `/shortlets?${backLinkQuery}`);
      if (parsedUi.checkIn) params.set("checkIn", parsedUi.checkIn);
      if (parsedUi.checkOut) params.set("checkOut", parsedUi.checkOut);
      if (parsedUi.guests) params.set("guests", parsedUi.guests);
      return `/properties/${propertyId}?${params.toString()}#cta`;
    },
    [backLinkQuery, parsedUi.checkIn, parsedUi.checkOut, parsedUi.guests]
  );

  const [queryDraft, setQueryDraft] = useState(parsedUi.where);
  const [checkInDraft, setCheckInDraft] = useState(parsedUi.checkIn);
  const [checkOutDraft, setCheckOutDraft] = useState(parsedUi.checkOut);
  const [guestsDraft, setGuestsDraft] = useState(parsedUi.guests);
  const [searchDatesOpen, setSearchDatesOpen] = useState(false);
  const [searchDateRangeDraft, setSearchDateRangeDraft] = useState<DateRange | undefined>(() =>
    createDateRangeFromDraftValues(parsedUi.checkIn, parsedUi.checkOut)
  );
  const [searchDateHint, setSearchDateHint] = useState<string | null>(null);
  const [isMobileDatePicker, setIsMobileDatePicker] = useState(false);

  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couplingState, setCouplingState] = useState<MapListCouplingState>(() =>
    createMapListCouplingState(null)
  );
  const [highlightedListingId, setHighlightedListingId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">(parsedUi.view);
  const [mapAreaState, setMapAreaState] = useState(() => createShortletMapSearchAreaState(parsedBounds));
  const [resolvedMapFitRequestKey, setResolvedMapFitRequestKey] = useState(mapFitRequestKey);
  const [cameraIntent, setCameraIntent] = useState<
    "initial" | "idle" | "user_search" | "user_search_area" | "location_change"
  >("initial");
  const [cameraIntentNonce, setCameraIntentNonce] = useState(1);
  const [mobileMapOpen, setMobileMapOpen] = useState(parsedUi.view === "map");
  const [desktopMapOpen, setDesktopMapOpen] = useState(true);
  const [mapMoveSearchMode, setMapMoveSearchMode] = useState<ShortletMapMoveSearchMode>(
    parsedUi.mapAutoSearch ? "auto" : "manual"
  );
  const [mapMoveUpdating, setMapMoveUpdating] = useState(false);
  const [nearbySearching, setNearbySearching] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set<string>());
  const [savedToast, setSavedToast] = useState<"Saved" | "Removed" | null>(null);
  const [showDelayedUpdatingIndicator, setShowDelayedUpdatingIndicator] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isCompactSearch, setIsCompactSearch] = useState(false);
  const [isSearchHeaderInView, setIsSearchHeaderInView] = useState(true);
  const [quickFiltersCollapsed, setQuickFiltersCollapsed] = useState(false);
  const [quickFiltersPopoverOpen, setQuickFiltersPopoverOpen] = useState(false);
  const [draftAdvancedFilters, setDraftAdvancedFilters] = useState<ShortletAdvancedFilterState>(() =>
    readShortletAdvancedFiltersFromParams(stableSearchParams)
  );
  const [recentSearches, setRecentSearches] = useState<ShortletSearchPreset[]>([]);
  const [savedSearches, setSavedSearches] = useState<ShortletSearchPreset[]>([]);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const whereInputRef = useRef<HTMLInputElement | null>(null);
  const datesTriggerRef = useRef<HTMLButtonElement | null>(null);
  const guestsInputRef = useRef<HTMLSelectElement | null>(null);
  const expandedSearchHeaderRef = useRef<HTMLDivElement | null>(null);
  const quickFiltersMeasureRef = useRef<HTMLDivElement | null>(null);
  const quickFiltersPopoverRef = useRef<HTMLDivElement | null>(null);
  const searchDatesPopoverRef = useRef<HTMLDivElement | null>(null);
  const mobileMapTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileMapDialogRef = useRef<HTMLDivElement | null>(null);
  const mobileMapPrimaryActionRef = useRef<HTMLButtonElement | null>(null);
  const mobileMapRestoreFocusRef = useRef<HTMLElement | null>(null);
  const mapMoveDebounceRef = useRef<number | null>(null);
  const mobileListScrollYRef = useRef(0);
  const [mobileMapInvalidateNonce, setMobileMapInvalidateNonce] = useState(0);

  useEffect(() => {
    setQueryDraft(parsedUi.where);
    setCheckInDraft(parsedUi.checkIn);
    setCheckOutDraft(parsedUi.checkOut);
    setSearchDateRangeDraft(createDateRangeFromDraftValues(parsedUi.checkIn, parsedUi.checkOut));
    setSearchDateHint(null);
    setGuestsDraft(parsedUi.guests);
    setMobileView(parsedUi.view);
    setMobileMapOpen(parsedUi.view === "map");
    setMapMoveSearchMode(parsedUi.mapAutoSearch ? "auto" : "manual");
  }, [parsedUi]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobileDatePicker(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setMapAreaState(createShortletMapSearchAreaState(parsedBounds));
  }, [parsedBounds]);

  useEffect(() => {
    setDraftAdvancedFilters(readShortletAdvancedFiltersFromParams(stableSearchParams));
  }, [stableSearchParams]);

  useEffect(() => {
    setRecentSearches(readRecentSearchPresets());
    setSavedSearches(readSavedSearchPresets());
    setSavedIds(new Set(getSavedIds()));
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== "shortlets:saved") return;
      setSavedIds(new Set(getSavedIds()));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setIsCompactSearch(shouldUseCompactShortletSearchPill(window.scrollY));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const node = expandedSearchHeaderRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsSearchHeaderInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSearchHeaderInView(entry.isIntersecting && entry.intersectionRatio >= 0.35);
      },
      {
        threshold: [0, 0.35, 0.6, 1],
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const recomputeQuickFilterCollapse = useCallback(() => {
    const measureNode = quickFiltersMeasureRef.current;
    if (!measureNode) return;
    setQuickFiltersCollapsed(measureNode.scrollWidth > measureNode.clientWidth + 1);
  }, []);

  useEffect(() => {
    recomputeQuickFilterCollapse();
    window.addEventListener("resize", recomputeQuickFilterCollapse);
    return () => window.removeEventListener("resize", recomputeQuickFilterCollapse);
  }, [recomputeQuickFilterCollapse]);

  useEffect(() => {
    recomputeQuickFilterCollapse();
  }, [recomputeQuickFilterCollapse, searchParamsKey]);

  useEffect(() => {
    if (!quickFiltersCollapsed) {
      setQuickFiltersPopoverOpen(false);
    }
  }, [quickFiltersCollapsed]);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/shortlets/search?${requestSearchQuery}`, {
          credentials: "include",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as SearchResponse | { error?: string } | null;
        if (!response.ok) {
          throw new Error((payload as { error?: string } | null)?.error || "Unable to fetch shortlets.");
        }
        const typed = payload as SearchResponse;
        setResults({
          ...typed,
          items: typed.items.map((item) => normalizeSearchItemImageFields(item)),
        });
        setResolvedMapFitRequestKey(mapFitRequestKey);
        setCouplingState((current) => {
          const normalized = typed.items;
          if (current.selectedId && normalized.some((item) => item.id === current.selectedId)) {
            return current;
          }
          return {
            ...current,
            selectedId: normalized[0]?.id ?? null,
          };
        });
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : "Unable to fetch shortlets.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setMapMoveUpdating(false);
        }
      }
    };
    void run();
    return () => controller.abort();
  }, [mapFitRequestKey, requestSearchQuery]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFiltersOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtersOpen]);

  useEffect(() => {
    if (!quickFiltersPopoverOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!quickFiltersPopoverRef.current) return;
      if (quickFiltersPopoverRef.current.contains(event.target as Node)) return;
      setQuickFiltersPopoverOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setQuickFiltersPopoverOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [quickFiltersPopoverOpen]);

  useEffect(() => {
    if (!searchDatesOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearchDatesOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchDatesOpen]);

  useEffect(() => {
    if (!searchDatesOpen || isMobileDatePicker) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchDatesPopoverRef.current?.contains(target)) return;
      if (datesTriggerRef.current?.contains(target)) return;
      setSearchDatesOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [isMobileDatePicker, searchDatesOpen]);

  useEffect(() => {
    if (!searchDatesOpen || !isMobileDatePicker) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileDatePicker, searchDatesOpen]);

  useEffect(() => {
    return () => {
      if (mapMoveDebounceRef.current !== null) {
        window.clearTimeout(mapMoveDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const isRefreshing = mapMoveUpdating || loading;
    if (!isRefreshing) {
      setShowDelayedUpdatingIndicator(false);
      return;
    }
    const timeout = window.setTimeout(() => {
      setShowDelayedUpdatingIndicator(true);
    }, 320);
    return () => window.clearTimeout(timeout);
  }, [loading, mapMoveUpdating]);

  useEffect(() => {
    if (!highlightedListingId) return;
    const timeout = window.setTimeout(() => setHighlightedListingId(null), 1500);
    return () => window.clearTimeout(timeout);
  }, [highlightedListingId]);

  useEffect(() => {
    if (!savedToast) return;
    const timeout = window.setTimeout(() => setSavedToast(null), 1200);
    return () => window.clearTimeout(timeout);
  }, [savedToast]);

  const updateUrl = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParamsKey);
      mutate(next);
      preserveExplicitShortletMarketParam({
        nextParams: next,
        sourceParams: stableSearchParams,
      });
      if (!next.get("view")) next.set("view", mobileView);
      next.set("page", "1");
      const query = next.toString();
      if (query === searchParamsKey) return false;
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      return true;
    },
    [mobileView, pathname, router, searchParamsKey, stableSearchParams]
  );

  const buildCurrentPresetParams = useCallback(
    (overrides?: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(stableSearchParams.toString());
      next.set("where", queryDraft.trim());
      next.set("guests", String(normalizeShortletGuestsParam(guestsDraft)));
      if (checkInDraft) next.set("checkIn", checkInDraft);
      else next.delete("checkIn");
      if (checkOutDraft) next.set("checkOut", checkOutDraft);
      else next.delete("checkOut");
      preserveExplicitShortletMarketParam({
        nextParams: next,
        sourceParams: stableSearchParams,
      });
      if (overrides) {
        for (const [key, value] of Object.entries(overrides)) {
          if (value == null || value === "") next.delete(key);
          else next.set(key, value);
        }
      }
      return createPresetParamsFromSearchParams(next);
    },
    [checkInDraft, checkOutDraft, guestsDraft, queryDraft, stableSearchParams]
  );

  const persistRecentSearch = useCallback(
    (params?: Record<string, string>) => {
      const nextParams = params ?? buildCurrentPresetParams();
      setRecentSearches(addRecentSearchPreset(nextParams));
    },
    [buildCurrentPresetParams]
  );

  const openSearchDatePicker = useCallback(() => {
    setSearchDateRangeDraft(createDateRangeFromDraftValues(checkInDraft, checkOutDraft));
    setSearchDateHint(null);
    setSearchDatesOpen(true);
  }, [checkInDraft, checkOutDraft]);

  const closeSearchDatePicker = useCallback(() => {
    setSearchDatesOpen(false);
  }, []);

  const onSearchDateRangeSelect = useCallback((next: DateRange | undefined) => {
    if (!next?.from) {
      setSearchDateRangeDraft(undefined);
      setSearchDateHint(null);
      return;
    }
    if (!next.to) {
      setSearchDateRangeDraft({ from: next.from, to: undefined });
      setSearchDateHint(null);
      return;
    }
    if (toDateKey(next.from) >= toDateKey(next.to)) {
      setSearchDateRangeDraft({ from: next.from, to: undefined });
      setSearchDateHint("Check-out must be after check-in.");
      return;
    }
    setSearchDateRangeDraft({ from: next.from, to: next.to });
    setSearchDateHint(null);
  }, []);

  const applySearchDateRange = useCallback(() => {
    if (!hasCompleteValidDateRange(searchDateRangeDraft)) {
      setSearchDateHint("Choose a valid check-in and check-out range.");
      return;
    }
    const nextCheckIn = toDateKey(searchDateRangeDraft.from);
    const nextCheckOut = toDateKey(searchDateRangeDraft.to!);
    setCheckInDraft(nextCheckIn);
    setCheckOutDraft(nextCheckOut);
    setSearchDateHint(null);
    closeSearchDatePicker();
  }, [closeSearchDatePicker, searchDateRangeDraft]);

  const clearSearchDateRangeDraft = useCallback(() => {
    setSearchDateRangeDraft(undefined);
    setSearchDateHint(null);
    setCheckInDraft("");
    setCheckOutDraft("");
  }, []);

  const onSubmitSearch = () => {
    const hasAnyDateDraft = Boolean(checkInDraft || checkOutDraft);
    const hasInvalidDateDraft =
      hasAnyDateDraft && (!checkInDraft || !checkOutDraft || checkInDraft >= checkOutDraft);
    if (hasInvalidDateDraft) {
      setSearchDateHint("Choose a valid check-in and check-out range.");
      openSearchDatePicker();
      return;
    }
    setSearchDateHint(null);
    const intent = resolveShortletMapCameraIntent({
      hasLocationChanged: queryDraft.trim() !== parsedUi.where.trim(),
      hasBoundsChanged: false,
    });
    setCameraIntent(intent);
    setCameraIntentNonce((current) => current + 1);
    updateUrl((next) => {
      const hasLocationChanged = queryDraft.trim() !== parsedUi.where.trim();
      if (queryDraft.trim()) next.set("where", queryDraft.trim());
      else next.delete("where");
      next.delete("q");
      if (hasLocationChanged) {
        next.delete("placeId");
        next.delete("lat");
        next.delete("lng");
        next.delete("bbox");
        next.delete("bounds");
      }
      if (checkInDraft) next.set("checkIn", checkInDraft);
      else next.delete("checkIn");
      if (checkOutDraft) next.set("checkOut", checkOutDraft);
      else next.delete("checkOut");
      next.set("guests", String(normalizeShortletGuestsParam(guestsDraft)));
    });
    persistRecentSearch();
  };

  const onSelectWhereSuggestion = useCallback(
    (suggestion: WhereSuggestion) => {
      const nextWhere = suggestion.label.trim();
      setQueryDraft(nextWhere);
      const intent = resolveShortletMapCameraIntent({
        hasLocationChanged: nextWhere !== parsedUi.where.trim(),
        hasBoundsChanged: false,
      });
      setCameraIntent(intent);
      setCameraIntentNonce((current) => current + 1);
      updateUrl((next) => {
        if (nextWhere) next.set("where", nextWhere);
        else next.delete("where");
        next.delete("q");
        if (suggestion.placeId) next.set("placeId", suggestion.placeId);
        else next.delete("placeId");
        if (Number.isFinite(suggestion.lat)) next.set("lat", String(suggestion.lat));
        else next.delete("lat");
        if (Number.isFinite(suggestion.lng)) next.set("lng", String(suggestion.lng));
        else next.delete("lng");
        next.delete("bbox");
        next.delete("bounds");
      });

      const recentParams = buildCurrentPresetParams({
        where: nextWhere,
        placeId: suggestion.placeId ?? null,
        lat: Number.isFinite(suggestion.lat) ? String(suggestion.lat) : null,
        lng: Number.isFinite(suggestion.lng) ? String(suggestion.lng) : null,
        bbox: null,
      });
      persistRecentSearch(recentParams);
    },
    [buildCurrentPresetParams, parsedUi.where, persistRecentSearch, updateUrl]
  );

  const onSearchNearby = useCallback(async () => {
    if (nearbySearching) return;
    setNearbySearching(true);

    try {
      if (typeof window === "undefined" || !("geolocation" in navigator)) {
        return;
      }

      const nearbyCoords = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        let settled = false;
        const complete = (value: { lat: number; lng: number } | null) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        const timeout = window.setTimeout(() => complete(null), 8_000);

        navigator.geolocation.getCurrentPosition(
          (position) => {
            window.clearTimeout(timeout);
            complete({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          () => {
            window.clearTimeout(timeout);
            complete(null);
          },
          {
            enableHighAccuracy: false,
            timeout: 7_000,
            maximumAge: 5 * 60 * 1000,
          }
        );
      });

      if (!nearbyCoords) {
        return;
      }

      const lat = Number(nearbyCoords.lat.toFixed(6));
      const lng = Number(nearbyCoords.lng.toFixed(6));
      const bbox = buildNearbySearchBbox(lat, lng);

      setCameraIntent("location_change");
      setCameraIntentNonce((current) => current + 1);
      updateUrl((next) => {
        next.delete("where");
        next.delete("q");
        next.set("placeId", "nearby-current");
        next.set("lat", String(lat));
        next.set("lng", String(lng));
        if (bbox) next.set("bbox", bbox);
        else next.delete("bbox");
        next.delete("bounds");
      });

      const recentParams = buildCurrentPresetParams({
        where: null,
        placeId: "nearby-current",
        lat: String(lat),
        lng: String(lng),
        bbox: bbox || null,
      });
      persistRecentSearch(recentParams);
    } finally {
      setNearbySearching(false);
    }
  }, [buildCurrentPresetParams, nearbySearching, persistRecentSearch, updateUrl]);

  const onApplySearchPreset = useCallback(
    (preset: ShortletSearchPreset) => {
      const presetParams = presetParamsToSearchParams(preset.params);
      preserveExplicitShortletMarketParam({
        nextParams: presetParams,
        sourceParams: stableSearchParams,
      });
      if (!presetParams.get("priceDisplay")) {
        presetParams.set("priceDisplay", formatPriceDisplayParam(parsedUi.priceDisplay));
      }
      if (!presetParams.get("view")) presetParams.set("view", mobileView);
      presetParams.set("page", "1");
      setQueryDraft(preset.params.where ?? "");
      setCheckInDraft(preset.params.checkIn ?? "");
      setCheckOutDraft(preset.params.checkOut ?? "");
      setGuestsDraft(String(normalizeShortletGuestsParam(preset.params.guests ?? "1")));
      setCameraIntent("location_change");
      setCameraIntentNonce((current) => current + 1);
      router.replace(`${pathname}?${presetParams.toString()}`, { scroll: false });
      persistRecentSearch(preset.params);
    },
    [mobileView, parsedUi.priceDisplay, pathname, persistRecentSearch, router, stableSearchParams]
  );

  const onSaveCurrentSearch = useCallback(() => {
    const params = buildCurrentPresetParams();
    const label = buildShortletPresetLabel(params);
    setSavedSearches(saveSearchPreset(params, label));
  }, [buildCurrentPresetParams]);

  const onClearRecentSearches = useCallback(() => {
    clearRecentSearchPresets();
    setRecentSearches([]);
  }, []);

  const onRemoveSavedSearch = useCallback((id: string) => {
    setSavedSearches(removeSavedSearchPreset(id));
  }, []);

  const focusExpandedControl = useCallback(
    (field: "where" | "checkIn" | "checkOut" | "guests") => {
      if (field === "checkIn" || field === "checkOut") {
        const target = datesTriggerRef.current;
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => {
          target.focus();
          openSearchDatePicker();
        }, 220);
        return;
      }
      const inputRef = field === "where" ? whereInputRef : guestsInputRef;
      const target = inputRef.current;
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => target.focus(), 220);
    },
    [openSearchDatePicker]
  );

  const applyAdvancedFilters = useCallback(
    (filters: ShortletAdvancedFilterState) => {
      updateUrl((next) => {
        writeShortletAdvancedFiltersToParams(next, filters);
      });
    },
    [updateUrl]
  );

  const applyBoundsSearchToUrl = useCallback(
    (bounds: ShortletSearchBounds | null) => {
      const encoded = serializeShortletSearchBbox(bounds);
      const changed = updateUrl((params) => {
        if (encoded) params.set("bbox", encoded);
        else params.delete("bbox");
        params.delete("bounds");
      });
      return changed;
    },
    [updateUrl]
  );

  const onSearchThisArea = useCallback(() => {
    const nextAreaState = applySearchThisArea(mapAreaState);
    setMapAreaState(nextAreaState);
    setCameraIntent(
      resolveShortletMapCameraIntent({
        hasLocationChanged: false,
        hasBoundsChanged: true,
      })
    );
    setCameraIntentNonce((current) => current + 1);
    void applyBoundsSearchToUrl(nextAreaState.activeBounds);
  }, [applyBoundsSearchToUrl, mapAreaState]);

  const onToggleMapMoveSearch = useCallback(
    (enabled: boolean) => {
      const mode: ShortletMapMoveSearchMode = enabled ? "auto" : "manual";
      setMapMoveSearchMode(mode);
      if (mapMoveDebounceRef.current !== null) {
        window.clearTimeout(mapMoveDebounceRef.current);
        mapMoveDebounceRef.current = null;
      }
      if (!enabled) {
        setMapMoveUpdating(false);
        updateUrl((next) => writeShortletMapMoveSearchMode(next, "manual"));
        return;
      }

      setMapMoveUpdating(true);
      const nextBounds = mapAreaState.draftBounds ?? mapAreaState.activeBounds ?? null;
      setMapAreaState({
        activeBounds: nextBounds,
        draftBounds: nextBounds,
        mapDirty: false,
      });
      const changed = updateUrl((next) => {
        writeShortletMapMoveSearchMode(next, "auto");
        const encoded = serializeShortletSearchBbox(nextBounds);
        if (encoded) next.set("bbox", encoded);
        else next.delete("bbox");
        next.delete("bounds");
      });
      if (!changed) {
        setMapMoveUpdating(false);
      }
    },
    [mapAreaState.activeBounds, mapAreaState.draftBounds, updateUrl]
  );

  const toggleQuickFilter = useCallback(
    (key: TrustFilterKey) => {
      const currentFilters = readShortletAdvancedFiltersFromParams(stableSearchParams);
      const nextFilters = { ...currentFilters, [key]: !currentFilters[key] };
      setDraftAdvancedFilters((previous) => ({ ...previous, [key]: nextFilters[key] }));
      applyAdvancedFilters(nextFilters);
    },
    [applyAdvancedFilters, stableSearchParams]
  );

  const onMapBoundsChanged = useCallback(
    (bounds: { north: number; south: number; east: number; west: number }) => {
      const nextBounds = bounds as ShortletSearchBounds;
      if (mapMoveSearchMode === "auto") {
        setMapAreaState({
          activeBounds: nextBounds,
          draftBounds: nextBounds,
          mapDirty: false,
        });
        if (mapMoveDebounceRef.current !== null) {
          window.clearTimeout(mapMoveDebounceRef.current);
        }
        setMapMoveUpdating(true);
        mapMoveDebounceRef.current = window.setTimeout(() => {
          mapMoveDebounceRef.current = null;
          const changed = updateUrl((next) => {
            writeShortletMapMoveSearchMode(next, "auto");
            const encoded = serializeShortletSearchBbox(nextBounds);
            if (encoded) next.set("bbox", encoded);
            else next.delete("bbox");
            next.delete("bounds");
          });
          if (!changed) {
            setMapMoveUpdating(false);
          }
        }, 450);
        return;
      }

      setMapAreaState((current) => applyMapViewportChange(current, nextBounds));
    },
    [mapMoveSearchMode, updateUrl]
  );

  const onSelectListing = (listingId: string) => {
    setCouplingState((current) => setMapListSelected(current, listingId, "map"));
    setHighlightedListingId(listingId);
    const row = cardRefs.current[listingId];
    if (row && shouldScrollCardIntoView({ source: "map", selectedId: listingId })) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const onHoverListingFromMap = useCallback((listingId: string | null) => {
    setCouplingState((current) =>
      listingId ? setMapListHover(current, listingId, "map") : clearMapListHover(current)
    );
    if (!listingId) return;
    const row = cardRefs.current[listingId];
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const nearTopEdge = rect.bottom >= -120 && rect.bottom < 140;
    const nearBottomEdge = rect.top <= window.innerHeight + 120 && rect.top > window.innerHeight - 140;
    if (nearTopEdge || nearBottomEdge) {
      row.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);

  const openFiltersDrawer = () => {
    setDraftAdvancedFilters(readShortletAdvancedFiltersFromParams(stableSearchParams));
    setFiltersOpen(true);
  };

  const openMapView = useCallback(() => {
    mobileMapRestoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : mobileMapTriggerRef.current;
    mobileListScrollYRef.current = window.scrollY;
    const nextView = toggleShortletSearchView("list");
    setMobileView(nextView);
    setMobileMapOpen(true);
    setMobileMapInvalidateNonce((current) => current + 1);
    updateUrl((next) => next.set("view", "map"));
  }, [updateUrl]);

  const openListView = useCallback(() => {
    const nextView = toggleShortletSearchView("map");
    setMobileView(nextView);
    setMobileMapOpen(false);
    updateUrl((next) => next.set("view", "list"));
    requestAnimationFrame(() => {
      window.scrollTo({ top: mobileListScrollYRef.current, behavior: "auto" });
      const focusTarget = mobileMapTriggerRef.current ?? mobileMapRestoreFocusRef.current;
      focusTarget?.focus();
    });
  }, [updateUrl]);

  useEffect(() => {
    if (!mobileMapOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const dialog = mobileMapDialogRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)) : [];
    const firstFocusable = focusable[0] ?? mobileMapPrimaryActionRef.current ?? dialog;
    const lastFocusable = focusable[focusable.length - 1] ?? firstFocusable;
    window.setTimeout(() => {
      firstFocusable?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        openListView();
        return;
      }
      if (event.key !== "Tab") return;
      if (!dialog) return;
      const activeElement = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (activeElement === firstFocusable || !dialog.contains(activeElement)) {
          event.preventDefault();
          lastFocusable?.focus();
        }
        return;
      }
      if (activeElement === lastFocusable || !dialog.contains(activeElement)) {
        event.preventDefault();
        firstFocusable?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMapOpen, openListView]);

  const clearDates = useCallback(() => {
    clearSearchDateRangeDraft();
    updateUrl((next) => {
      next.delete("checkIn");
      next.delete("checkOut");
      next.set("page", "1");
    });
  }, [clearSearchDateRangeDraft, updateUrl]);

  const onTogglePriceDisplay = useCallback(
    (enabled: boolean) => {
      updateUrl((next) => {
        next.set("priceDisplay", formatPriceDisplayParam(enabled ? "total" : "nightly"));
      });
    },
    [updateUrl]
  );

  const clearMapArea = useCallback(() => {
    setMapAreaState(() => ({
      activeBounds: null,
      draftBounds: null,
      mapDirty: false,
    }));
    setCameraIntent("user_search_area");
    setCameraIntentNonce((current) => current + 1);
    updateUrl((next) => {
      next.delete("bbox");
      next.delete("bounds");
      next.set("page", "1");
    });
  }, [updateUrl]);

  const clearAdvancedFilters = useCallback(() => {
    const cleared = createDefaultShortletAdvancedFilters();
    setDraftAdvancedFilters(cleared);
    applyAdvancedFilters(cleared);
  }, [applyAdvancedFilters]);

  const setSavedView = useCallback(
    (enabled: boolean) => {
      updateUrl((next) => {
        writeShortletSavedViewParam(next, enabled);
        next.set("page", "1");
      });
    },
    [updateUrl]
  );

  const onToggleSavedListing = useCallback((listingId: string) => {
    const next = toggleSaved(listingId);
    setSavedIds(new Set(next.ids));
    setSavedToast(next.saved ? "Saved" : "Removed");
  }, []);

  const onSearchNigeria = useCallback(() => {
    const destination = "Nigeria";
    setQueryDraft(destination);
    setCameraIntent("location_change");
    setCameraIntentNonce((current) => current + 1);
    updateUrl((next) => {
      next.set("where", destination);
      next.delete("placeId");
      next.delete("lat");
      next.delete("lng");
      next.delete("bbox");
      next.delete("bounds");
      writeShortletSavedViewParam(next, false);
      next.set("page", "1");
    });
  }, [updateUrl]);

  const appliedAdvancedFilters = useMemo(
    () => readShortletAdvancedFiltersFromParams(stableSearchParams),
    [stableSearchParams]
  );
  const trustFilterState = useMemo(
    () =>
      new Set(
        TRUST_FILTERS.filter((item) => appliedAdvancedFilters[item.key]).map((item) => item.key)
      ),
    [appliedAdvancedFilters]
  );
  const activeQuickFilterCount = useMemo(
    () => QUICK_FILTERS.filter((filter) => trustFilterState.has(filter.key)).length,
    [trustFilterState]
  );
  const activeFilterTags = useMemo(
    () => listShortletActiveFilterTags(appliedAdvancedFilters),
    [appliedAdvancedFilters]
  );
  const appliedFilterCount = activeFilterTags.length;
  const visibleFilterTags = activeFilterTags.slice(0, 3);
  const hiddenFilterTagCount = Math.max(0, activeFilterTags.length - visibleFilterTags.length);
  const savedOnlyActive = useMemo(
    () => isShortletSavedViewEnabled(stableSearchParams.get("saved")),
    [stableSearchParams]
  );
  const filteredItems = useMemo(() => {
    const items = results?.items ?? [];
    if (!savedOnlyActive) return items;
    return items.filter((item) => savedIds.has(item.id));
  }, [results?.items, savedIds, savedOnlyActive]);
  const filteredTotal = filteredItems.length;
  const selectedListingId = couplingState.selectedId;
  const hoveredListingId = couplingState.hoverId;

  const mapListings = useMemo(
    () => {
      const filteredById = new Map(filteredItems.map((item) => [item.id, item]));
      if (results?.mapItems?.length) {
        const allowedIds = new Set(filteredItems.map((item) => item.id));
        return results.mapItems
          .filter((item) => allowedIds.has(item.id))
          .map((item) => ({
            ...item,
            pricingMode:
              filteredById.get(item.id)?.pricingMode ??
              item.pricingMode ??
              (typeof item.nightlyPriceMinor === "number" && item.nightlyPriceMinor > 0
                ? "nightly"
                : "price_on_request"),
            bookingMode:
              resolveShortletBookingMode(filteredById.get(item.id) ?? {}) ??
              item.bookingMode ??
              "request",
            mapPreviewImageUrl:
              filteredById.get(item.id)?.mapPreviewImageUrl ??
              item.mapPreviewImageUrl ??
              item.primaryImageUrl ??
              null,
            latitude: typeof item.latitude === "number" ? item.latitude : null,
            longitude: typeof item.longitude === "number" ? item.longitude : null,
            href: buildPropertyHref(item.id),
          }));
      }
      return filteredItems.map((item) => ({
        id: item.id,
        title: item.title,
        city: item.city,
        currency: item.currency,
        nightlyPriceMinor: resolveShortletNightlyPriceMinor(item),
        pricingMode: item.pricingMode ?? "nightly",
        bookingMode: resolveShortletBookingMode(item) ?? "request",
        primaryImageUrl: item.primaryImageUrl ?? item.cover_image_url ?? null,
        mapPreviewImageUrl: item.mapPreviewImageUrl ?? item.primaryImageUrl ?? item.cover_image_url ?? null,
        latitude: typeof item.latitude === "number" ? item.latitude : null,
        longitude: typeof item.longitude === "number" ? item.longitude : null,
        href: buildPropertyHref(item.id),
      }));
    },
    [buildPropertyHref, filteredItems, results?.mapItems]
  );
  const mapResultHash = useMemo(() => {
    const ids = mapListings.map((listing) => listing.id).join(",");
    return `${parsedUi.market}|${mapListings.length}|${ids}`;
  }, [mapListings, parsedUi.market]);

  const selectedSummary = useMemo(() => {
    const match = filteredItems.find((item) => item.id === selectedListingId) ?? null;
    if (!match) return null;
    return {
      id: match.id,
      title: match.title,
      city: match.city,
      nightly: formatMoney(match.currency, resolveShortletNightlyPriceMinor(match)),
    };
  }, [filteredItems, selectedListingId]);

  useEffect(() => {
    setCouplingState((current) => {
      if (current.selectedId && filteredItems.some((item) => item.id === current.selectedId)) {
        return current;
      }
      return {
        ...current,
        selectedId: filteredItems[0]?.id ?? null,
      };
    });
  }, [filteredItems]);

  const searchAreaDirty = mapAreaState.mapDirty;
  const isMapMoveSearchEnabled = mapMoveSearchMode === "auto";
  const hasNearbyPlaceId = parsedUi.placeId.startsWith("nearby-current");
  const whereSummary = queryDraft.trim() || (hasNearbyPlaceId ? "Nearby" : "Where");
  const datesSummary =
    checkInDraft && checkOutDraft
      ? `${formatCompactDate(checkInDraft)} - ${formatCompactDate(checkOutDraft)}`
      : checkInDraft
        ? `${formatCompactDate(checkInDraft)} - Checkout`
        : "Dates";
  const guestsSummary = formatShortletGuestsLabel(guestsDraft);
  const searchControlVisibility = resolveShortletSearchControlVisibility({
    isCompactSearch,
    isSearchHeaderInView,
  });
  const showCompactSearch = searchControlVisibility.compactActive;
  const showExpandedSearch = searchControlVisibility.expandedActive;
  const isBboxApplied = useMemo(
    () => isShortletBboxApplied(stableSearchParams.get("bbox")),
    [stableSearchParams]
  );
  const resultsLabel = loading
    ? "Loading stays..."
    : resolveShortletResultsLabel({
        total: savedOnlyActive ? filteredTotal : (results?.total ?? 0),
        isBboxApplied,
      });
  const pendingMapAreaLabel = isMapMoveSearchEnabled
    ? showDelayedUpdatingIndicator
      ? "Refreshing map results…"
      : "Map movement updates results automatically."
    : resolveShortletPendingMapAreaLabel(searchAreaDirty);
  const desktopLayoutClass = desktopMapOpen
    ? "hidden gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    : "hidden gap-4 lg:grid lg:grid-cols-1";
  const desktopCardsGridClass = desktopMapOpen
    ? "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]"
    : "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]";
  const preferredCenter =
    typeof parsedUi.lat === "number" && typeof parsedUi.lng === "number"
      ? ([parsedUi.lat, parsedUi.lng] as [number, number])
      : null;

  const marketCurrency = getMarketCurrency(parsedUi.market);
  const activeDestination = parsedUi.where.trim();
  const hasValidPriceDates = Boolean(
    parsedUi.checkIn &&
      parsedUi.checkOut &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsedUi.checkIn) &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsedUi.checkOut) &&
      parsedUi.checkIn < parsedUi.checkOut
  );
  const totalPriceDisplayActive = isTotalPriceEnabled({
    hasDates: hasValidPriceDates,
    priceDisplay: parsedUi.priceDisplay,
  });
  const activeDrawerToggleCount =
    Number(isMapMoveSearchEnabled) + Number(totalPriceDisplayActive) + Number(savedOnlyActive);
  const hasActiveDrawerIndicator = appliedFilterCount > 0 || activeDrawerToggleCount > 0;
  const hasDateSelection = Boolean(parsedUi.checkIn || parsedUi.checkOut);
  const heading = activeDestination
    ? isNigeriaDestinationQuery(activeDestination)
      ? "Find shortlets across Nigeria"
      : `Find shortlets in ${activeDestination}`
    : "Find shortlets anywhere";
  const currencyCodesInResults = new Set(
    filteredItems.map((item) => String(item.currency || "").trim().toUpperCase()).filter(Boolean)
  );
  const pricingContextCopy =
    currencyCodesInResults.size > 1
      ? "Prices vary by listing."
      : `Prices shown in ${marketCurrency}. Market changes pricing context, not destination.`;
  const showExploreMapHint = !isBboxApplied && !activeDestination;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] min-w-0 flex-col gap-4 px-4 py-4">
      <div
        aria-hidden={mobileMapOpen}
        {...(mobileMapOpen ? ({ inert: "" } as Record<string, string>) : {})}
        data-testid="shortlets-shell-background"
      >
      {showCompactSearch ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-20 z-30 flex translate-y-0 justify-center px-4 opacity-100 transition-all duration-200"
          data-testid="shortlets-compact-search-pill"
          data-active="true"
          aria-hidden={false}
        >
          <div className="pointer-events-auto w-full max-w-[1200px] rounded-full border border-slate-200 bg-white/95 px-2 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="flex min-w-0 flex-wrap items-center gap-2 md:flex-nowrap">
              <button
                type="button"
                onClick={() => focusExpandedControl("where")}
                className="inline-flex h-9 min-w-0 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <span className="truncate">{whereSummary}</span>
              </button>
              <button
                type="button"
                onClick={() => focusExpandedControl("checkIn")}
                className="inline-flex h-9 min-w-0 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <span className="truncate">{datesSummary}</span>
              </button>
              <button
                type="button"
                onClick={() => focusExpandedControl("guests")}
                className="inline-flex h-9 min-w-0 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <span className="truncate">{guestsSummary}</span>
              </button>
              <div className="ml-auto flex items-center gap-2">
                <Select
                  value={parsedUi.sort}
                  onChange={(event) => updateUrl((next) => next.set("sort", event.target.value))}
                  className="h-9 w-[126px] text-xs"
                  aria-label="Sort compact"
                >
                  <option value="recommended">Recommended</option>
                  <option value="price_asc">Price low-high</option>
                  <option value="price_desc">Price high-low</option>
                  <option value="rating">Rating</option>
                  <option value="newest">Newest</option>
                </Select>
                <Button onClick={onSubmitSearch} size="sm" className="h-9 whitespace-nowrap">
                  Search
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={openFiltersDrawer}
                  className="h-9 whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span>{appliedFilterCount > 0 ? `Filters (${appliedFilterCount})` : "Filters"}</span>
                    {hasActiveDrawerIndicator ? (
                      <span
                        className="h-2 w-2 rounded-full bg-sky-500"
                        data-testid="shortlets-filters-active-indicator-compact"
                      />
                    ) : null}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Shortlets</p>
        <h1 className="text-2xl font-semibold text-slate-900">{heading}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Search by area, landmark, and dates. Map prices are nightly and availability-aware.
        </p>
        <p className="mt-1 text-xs text-slate-500">{pricingContextCopy}</p>

        <div
          ref={expandedSearchHeaderRef}
          className="mt-3"
          data-testid="shortlets-expanded-search-controls"
          aria-hidden={!showExpandedSearch}
          data-active={showExpandedSearch ? "true" : "false"}
          {...(!showExpandedSearch ? ({ inert: "" } as Record<string, string>) : {})}
        >
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.15fr)_minmax(0,0.75fr)_auto_auto_minmax(0,0.85fr)]">
          <WhereTypeahead
            inputRef={whereInputRef}
            value={queryDraft}
            market={parsedUi.market}
            onValueChange={setQueryDraft}
            onSelectSuggestion={onSelectWhereSuggestion}
            onApplyPreset={onApplySearchPreset}
            onSaveCurrent={onSaveCurrentSearch}
            onClearRecents={onClearRecentSearches}
            onRemoveSaved={onRemoveSavedSearch}
            onRequestNearby={onSearchNearby}
            recentPresets={recentSearches}
            savedPresets={savedSearches}
          />
          <div className="relative">
            <button
              ref={datesTriggerRef}
              type="button"
              onClick={openSearchDatePicker}
              aria-label="Select dates"
              aria-haspopup="dialog"
              aria-expanded={searchDatesOpen}
              className="flex h-11 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 text-left text-sm text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              data-testid="shortlets-date-range-trigger"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Dates</span>
              <span className="truncate pl-2 font-semibold text-slate-800">{datesSummary}</span>
            </button>
            {searchDateHint ? (
              <p className="mt-1 text-xs text-slate-500" data-testid="shortlets-date-range-hint">
                {searchDateHint}
              </p>
            ) : null}
            {searchDatesOpen && !isMobileDatePicker ? (
              <div
                ref={searchDatesPopoverRef}
                role="dialog"
                aria-modal="false"
                aria-label="Select dates"
                className="absolute left-0 top-[calc(100%+8px)] z-30 w-[min(620px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_16px_45px_rgba(15,23,42,0.2)]"
                data-testid="shortlets-date-range-popover"
              >
                <Calendar
                  mode="range"
                  selected={searchDateRangeDraft}
                  numberOfMonths={2}
                  disabled={{ before: new Date() }}
                  onSelect={onSearchDateRangeSelect}
                  defaultMonth={searchDateRangeDraft?.from ?? new Date()}
                  className="rounded-xl border border-slate-100 bg-white"
                />
                <div className="mt-2 flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
                  <Button type="button" variant="secondary" size="sm" onClick={clearSearchDateRangeDraft}>
                    Clear
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={applySearchDateRange}
                    disabled={!hasCompleteValidDateRange(searchDateRangeDraft)}
                  >
                    Apply dates
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <Select
            ref={guestsInputRef}
            value={guestsDraft}
            onChange={(event) => setGuestsDraft(event.target.value)}
            aria-label="Guests"
            className="h-11"
          >
            {Array.from({ length: 16 }).map((_, index) => {
              const guestsCount = index + 1;
              const label = formatShortletGuestsLabel(guestsCount);
              return (
                <option key={`guests-option-${guestsCount}`} value={guestsCount}>
                  {label}
                </option>
              );
            })}
          </Select>
          <Button onClick={onSubmitSearch} className="h-11 whitespace-nowrap">
            Search
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={openFiltersDrawer}
            className="h-11 whitespace-nowrap"
            data-testid="shortlets-filters-button"
          >
            <span className="inline-flex items-center gap-1.5">
              <span>{appliedFilterCount > 0 ? `Filters (${appliedFilterCount})` : "Filters"}</span>
              {hasActiveDrawerIndicator ? (
                <span
                  className="h-2 w-2 rounded-full bg-sky-500"
                  data-testid="shortlets-filters-active-indicator"
                />
              ) : null}
            </span>
          </Button>
          <Select
            value={parsedUi.sort}
            onChange={(event) => updateUrl((next) => next.set("sort", event.target.value))}
            className="h-11 min-w-[170px]"
            aria-label="Sort"
          >
            <option value="recommended">Recommended</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="rating">Rating</option>
            <option value="newest">Newest</option>
          </Select>
        </div>
        </div>

        <div className="relative mt-3 min-w-0">
          <div
            ref={quickFiltersMeasureRef}
            className="pointer-events-none invisible absolute inset-x-0 top-0 flex h-9 min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap"
            aria-hidden="true"
          >
            {QUICK_FILTERS.map((filter) => (
              <span
                key={`quick-filter-measure-${filter.key}`}
                className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold"
              >
                {filter.label}
              </span>
            ))}
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              {quickFiltersCollapsed ? (
                <div
                  ref={quickFiltersPopoverRef}
                  className="relative"
                  data-testid="shortlets-quick-filters-collapsed"
                >
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setQuickFiltersPopoverOpen((current) => !current)}
                    className="h-9 whitespace-nowrap"
                    data-testid="shortlets-quick-filters-button"
                  >
                    {activeQuickFilterCount > 0 ? `Quick filters (${activeQuickFilterCount})` : "Quick filters"}
                  </Button>
                  {quickFiltersPopoverOpen ? (
                    <div
                      className="absolute left-0 top-full z-20 mt-2 w-[240px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
                      role="dialog"
                      aria-label="Quick filters"
                      data-testid="shortlets-quick-filters-popover"
                    >
                      <div className="space-y-1">
                        {QUICK_FILTERS.map((filter) => {
                          const active = trustFilterState.has(filter.key);
                          return (
                            <button
                              key={`quick-filter-popover-${filter.key}`}
                              type="button"
                              onClick={() => toggleQuickFilter(filter.key)}
                              className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition ${
                                active
                                  ? "border-sky-500 bg-sky-50 text-sky-700"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              <span>{filter.label}</span>
                              <span aria-hidden="true">{active ? "✓" : ""}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div
                  className="flex h-9 min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap"
                  data-testid="shortlets-quick-filters"
                >
                  {QUICK_FILTERS.map((filter) => {
                    const active = trustFilterState.has(filter.key);
                    return (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => toggleQuickFilter(filter.key)}
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          active
                            ? "border-sky-500 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {filter.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {activeFilterTags.length > 0 ? (
          <div
            className="mt-2 flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap"
            data-testid="shortlets-active-filter-summary"
          >
            {visibleFilterTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() =>
                  updateUrl((next) => {
                    removeShortletAdvancedFilterTag(next, tag);
                  })
                }
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
                title={`Remove ${tag.label}`}
              >
                <span>{tag.label}</span>
                <span aria-hidden="true">×</span>
              </button>
            ))}
            {hiddenFilterTagCount > 0 ? (
              <span className="truncate text-xs text-slate-500">+{hiddenFilterTagCount} more</span>
            ) : null}
          </div>
        ) : null}
      </section>

      {filtersOpen ? (
        <>
          <button
            type="button"
            aria-label="Close filters"
            className="fixed inset-0 z-40 bg-slate-900/30"
            onClick={() => setFiltersOpen(false)}
            data-testid="shortlets-filters-overlay"
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end">
            <aside
              className="pointer-events-auto flex max-h-[86vh] w-full flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl md:h-full md:max-h-none md:w-[420px] md:rounded-none md:border-l md:border-t-0"
              role="dialog"
              aria-modal="true"
              aria-label="Shortlet filters"
              data-testid="shortlets-filters-drawer"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Filters</p>
                  <p className="text-xs text-slate-500">Refine shortlets without cluttering the map view.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                  aria-label="Close filters"
                >
                  ×
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-slate-900">Amenities and trust</h2>
                  <div className="space-y-2">
                    {TRUST_FILTERS.map((filter) => (
                      <label
                        key={`drawer-filter-${filter.key}`}
                        className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700"
                      >
                        <span>{filter.label}</span>
                        <input
                          type="checkbox"
                          checked={draftAdvancedFilters[filter.key]}
                          onChange={(event) =>
                            setDraftAdvancedFilters((current) => ({
                              ...current,
                              [filter.key]: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                      </label>
                    ))}
                  </div>
                </section>

                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-slate-900">Booking mode</h2>
                  <Select
                    value={draftAdvancedFilters.bookingMode}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDraftAdvancedFilters((current) => ({
                        ...current,
                        bookingMode: value === "instant" || value === "request" ? value : "",
                      }));
                    }}
                    aria-label="Booking mode filter"
                  >
                    <option value="">All booking modes</option>
                    <option value="instant">Instant book</option>
                    <option value="request">Request to book</option>
                  </Select>
                </section>

                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-slate-900">Cancellation</h2>
                  <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
                    <span>Free cancellation</span>
                    <input
                      type="checkbox"
                      checked={draftAdvancedFilters.freeCancellation}
                      onChange={(event) =>
                        setDraftAdvancedFilters((current) => ({
                          ...current,
                          freeCancellation: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                  </label>
                </section>

                <section className="space-y-2">
                  <h2 className="text-sm font-semibold text-slate-900">View options</h2>
                  <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
                    <span>Search as I move the map</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      checked={isMapMoveSearchEnabled}
                      onChange={(event) => onToggleMapMoveSearch(event.target.checked)}
                      data-testid="shortlets-map-move-toggle"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
                    <span>Display total price</span>
                    <input
                      type="checkbox"
                      checked={totalPriceDisplayActive}
                      disabled={!hasValidPriceDates}
                      onChange={(event) => onTogglePriceDisplay(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      data-testid="shortlets-price-display-toggle"
                    />
                  </label>
                  {!hasValidPriceDates ? (
                    <p className="text-xs text-slate-500" data-testid="shortlets-price-display-helper">
                      Select dates to see total price.
                    </p>
                  ) : null}
                  <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
                    <span>Saved only</span>
                    <input
                      type="checkbox"
                      checked={savedOnlyActive}
                      onChange={(event) => setSavedView(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      data-testid="shortlets-saved-toggle"
                    />
                  </label>
                </section>
              </div>

              <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const cleared = createDefaultShortletAdvancedFilters();
                    setDraftAdvancedFilters(cleared);
                    applyAdvancedFilters(cleared);
                    setFiltersOpen(false);
                  }}
                >
                  Clear all
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    applyAdvancedFilters(draftAdvancedFilters);
                    setFiltersOpen(false);
                  }}
                >
                  Apply
                </Button>
              </div>
            </aside>
          </div>
        </>
      ) : null}

      {searchDatesOpen && isMobileDatePicker ? (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-white md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Select dates"
          data-testid="shortlets-date-range-sheet"
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Select dates</p>
              <p className="text-xs text-slate-500">Choose check-in and check-out for your stay.</p>
            </div>
            <button
              type="button"
              aria-label="Close date picker"
              onClick={closeSearchDatePicker}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
            >
              ×
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <Calendar
              mode="range"
              selected={searchDateRangeDraft}
              numberOfMonths={1}
              disabled={{ before: new Date() }}
              onSelect={onSearchDateRangeSelect}
              defaultMonth={searchDateRangeDraft?.from ?? new Date()}
              className="mx-auto max-w-sm rounded-xl border border-slate-100 bg-white"
            />
            {searchDateHint ? (
              <p className="mt-2 text-xs text-slate-500" data-testid="shortlets-date-range-hint-mobile">
                {searchDateHint}
              </p>
            ) : null}
          </div>
          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
            <Button type="button" variant="secondary" onClick={clearSearchDateRangeDraft}>
              Clear
            </Button>
            <Button
              type="button"
              onClick={applySearchDateRange}
              disabled={!hasCompleteValidDateRange(searchDateRangeDraft)}
            >
              Apply dates
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className={desktopLayoutClass}>
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600" data-testid="shortlets-results-label">
                {resultsLabel}
              </p>
              {desktopMapOpen && pendingMapAreaLabel ? (
                <p className="mt-1 text-xs text-slate-500">{pendingMapAreaLabel}</p>
              ) : null}
              {isBboxApplied ? (
                <button
                  type="button"
                  onClick={clearMapArea}
                  className="mt-2 inline-flex h-7 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  data-testid="shortlets-clear-map-area"
                >
                  Clear map area
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              {filteredTotal === 0 && !!parsedUi.checkIn && !!parsedUi.checkOut ? (
                <p className="text-xs text-slate-500">Try nearby dates or expand map area.</p>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDesktopMapOpen((current) => !current)}
                data-testid="shortlets-desktop-map-toggle"
              >
                {desktopMapOpen ? "Hide map" : "Show map"}
              </Button>
            </div>
          </div>
          {loading && filteredTotal === 0 ? (
            <div className={`${desktopCardsGridClass} min-h-[420px]`} data-testid="shortlets-desktop-loading-skeleton">
              {Array.from({ length: 6 }).map((_, index) => (
                <PropertyCardSkeleton key={`shortlet-list-skeleton-${index}`} />
              ))}
            </div>
          ) : filteredTotal > 0 ? (
            <div className="space-y-3 min-h-[420px]">
              <div className={desktopCardsGridClass} data-testid="shortlets-desktop-results-grid">
                {filteredItems.map((property) => {
                  const selected = property.id === selectedListingId;
                  const highlighted =
                    selected || property.id === hoveredListingId || property.id === highlightedListingId;
                  return (
                    <div
                      key={property.id}
                      ref={(node) => {
                        cardRefs.current[property.id] = node;
                      }}
                      className={`h-full rounded-2xl border ${
                        highlighted ? "border-sky-300 ring-2 ring-sky-100" : "border-transparent"
                      }`}
                      onMouseEnter={() =>
                        setCouplingState((current) => setMapListHover(current, property.id, "list"))
                      }
                      onMouseLeave={() =>
                        setCouplingState((current) => clearMapListHover(current))
                      }
                      onClick={() =>
                        setCouplingState((current) => setMapListSelected(current, property.id, "list"))
                      }
                      data-listing-id={property.id}
                    >
                      <ShortletsSearchListCard
                        property={property}
                        priceDisplayMode={totalPriceDisplayActive ? "total" : "nightly"}
                        href={buildPropertyHref(property.id)}
                        selected={selected}
                        highlighted={property.id === hoveredListingId}
                        isSaved={savedIds.has(property.id)}
                        onToggleSaved={() => onToggleSavedListing(property.id)}
                        onFocus={() =>
                          setCouplingState((current) => setMapListHover(current, property.id, "list"))
                        }
                        onBlur={() =>
                          setCouplingState((current) => clearMapListHover(current))
                        }
                      />
                    </div>
                  );
                })}
              </div>
              {loading ? (
                <div className={desktopCardsGridClass} data-testid="shortlets-desktop-refresh-skeleton">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <PropertyCardSkeleton key={`shortlet-refresh-skeleton-${index}`} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">
                {savedOnlyActive
                  ? "No saved stays yet."
                  : isBboxApplied
                  ? "No stays in this map area."
                  : activeDestination
                    ? `No stays found in ${activeDestination}.`
                    : "No shortlets found yet."}
              </p>
              <p className="mt-1">
                {savedOnlyActive
                  ? "Save shortlets with the heart icon and they will appear here."
                  : isBboxApplied
                  ? "Try zooming out or clear the map area."
                  : activeDestination
                    ? "Try nearby areas or remove dates."
                    : "Try setting dates, destination, or filters."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {savedOnlyActive ? (
                  <>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setSavedView(false)}>
                      Browse stays
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={onSearchNigeria}>
                      Search Nigeria
                    </Button>
                  </>
                ) : null}
                {isBboxApplied ? (
                  <Button type="button" variant="secondary" size="sm" onClick={clearMapArea}>
                    Zoom out / clear map area
                  </Button>
                ) : null}
                {!savedOnlyActive && hasDateSelection ? (
                  <>
                    <Button type="button" variant="secondary" size="sm" onClick={clearDates}>
                      Clear dates
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void onSearchNearby()}
                      disabled={nearbySearching}
                    >
                      {nearbySearching ? "Finding nearby..." : "Search nearby"}
                    </Button>
                  </>
                ) : !savedOnlyActive ? (
                  <Button type="button" variant="secondary" size="sm" onClick={clearAdvancedFilters}>
                    Clear filters
                  </Button>
                ) : null}
              </div>
              {results?.nearbyAlternatives?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {results.nearbyAlternatives.map((item) => (
                    <li key={item.label}>{item.hint}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </section>

        {desktopMapOpen ? (
          <section className="sticky top-20 h-fit">
          <div className="relative">
            <ShortletsSearchMap
              listings={mapListings}
              selectedListingId={selectedListingId}
              hoveredListingId={hoveredListingId}
              onSelectListing={onSelectListing}
              onHoverListing={onHoverListingFromMap}
              onBoundsChanged={onMapBoundsChanged}
              marketCountry={parsedUi.market}
              resultHash={mapResultHash}
              cameraIntent={cameraIntent}
              cameraIntentNonce={cameraIntentNonce}
              fitRequestKey={mapFitRequestKey}
              resolvedFitRequestKey={resolvedMapFitRequestKey}
              preferredCenter={preferredCenter}
              height="min(76vh, 800px)"
              invalidateNonce={0}
            />
            {showExploreMapHint ? (
              <div className="pointer-events-none absolute left-0 right-0 top-3 flex justify-center">
                <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
                  Explore the map, then use Search this area.
                </span>
              </div>
            ) : null}
            {!isMapMoveSearchEnabled && searchAreaDirty ? (
              <div className="pointer-events-none absolute left-0 right-0 top-3 flex justify-center">
                <Button className="pointer-events-auto" onClick={onSearchThisArea}>
                  Search this area
                </Button>
              </div>
            ) : null}
            {isBboxApplied ? (
              <div className="pointer-events-none absolute left-3 top-3 flex">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="pointer-events-auto"
                  onClick={clearMapArea}
                >
                  Clear map area
                </Button>
              </div>
            ) : null}
          </div>
          </section>
        ) : null}
      </div>

      <div className="space-y-3 pb-20 lg:hidden">
        <div>
          <p className="text-sm text-slate-600">{resultsLabel}</p>
          {pendingMapAreaLabel ? <p className="mt-1 text-xs text-slate-500">{pendingMapAreaLabel}</p> : null}
          {isBboxApplied ? (
            <button
              type="button"
              onClick={clearMapArea}
              className="mt-2 inline-flex h-7 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Clear map area
            </button>
          ) : null}
        </div>
        {loading && filteredTotal === 0 ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <PropertyCardSkeleton key={`shortlet-mobile-skeleton-${index}`} />
            ))}
          </div>
        ) : filteredTotal > 0 ? (
          <div className="grid gap-3">
            {filteredItems.map((property) => {
              const selected = property.id === selectedListingId;
              const highlighted =
                selected || property.id === hoveredListingId || property.id === highlightedListingId;
              return (
                <div
                  key={property.id}
                  ref={(node) => {
                    cardRefs.current[property.id] = node;
                  }}
                  className={`h-full rounded-2xl border ${
                    highlighted ? "border-sky-300 ring-2 ring-sky-100" : "border-transparent"
                  }`}
                  onClick={() =>
                    setCouplingState((current) => setMapListSelected(current, property.id, "list"))
                  }
                  onMouseEnter={() =>
                    setCouplingState((current) => setMapListHover(current, property.id, "list"))
                  }
                  onMouseLeave={() =>
                    setCouplingState((current) => clearMapListHover(current))
                  }
                  data-listing-id={property.id}
                >
                  <ShortletsSearchListCard
                    property={property}
                    priceDisplayMode={totalPriceDisplayActive ? "total" : "nightly"}
                    href={buildPropertyHref(property.id)}
                    selected={selected}
                    highlighted={property.id === hoveredListingId}
                    isSaved={savedIds.has(property.id)}
                    onToggleSaved={() => onToggleSavedListing(property.id)}
                    onFocus={() =>
                      setCouplingState((current) => setMapListHover(current, property.id, "list"))
                    }
                    onBlur={() =>
                      setCouplingState((current) => clearMapListHover(current))
                    }
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">
              {savedOnlyActive
                ? "No saved stays yet."
                : isBboxApplied
                ? "No stays in this map area."
                : activeDestination
                  ? `No stays found in ${activeDestination}.`
                  : "No shortlets found yet."}
            </p>
            <p className="mt-1">
              {savedOnlyActive
                ? "Save shortlets with the heart icon and they will appear here."
                : isBboxApplied
                ? "Try zooming out or clear the map area."
                : activeDestination
                  ? "Try nearby areas or remove dates."
                  : "Try setting dates, destination, or filters."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {savedOnlyActive ? (
                <>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setSavedView(false)}>
                    Browse stays
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={onSearchNigeria}>
                    Search Nigeria
                  </Button>
                </>
              ) : null}
              {isBboxApplied ? (
                <Button type="button" variant="secondary" size="sm" onClick={clearMapArea}>
                  Zoom out / clear map area
                </Button>
              ) : null}
              {!savedOnlyActive && hasDateSelection ? (
                <>
                  <Button type="button" variant="secondary" size="sm" onClick={clearDates}>
                    Clear dates
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void onSearchNearby()}
                    disabled={nearbySearching}
                  >
                    {nearbySearching ? "Finding nearby..." : "Search nearby"}
                  </Button>
                </>
              ) : !savedOnlyActive ? (
                <Button type="button" variant="secondary" size="sm" onClick={clearAdvancedFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <button
        ref={mobileMapTriggerRef}
        type="button"
        onClick={openMapView}
        aria-haspopup="dialog"
        aria-expanded={mobileMapOpen}
        aria-controls="shortlets-mobile-map-modal"
        className="fixed bottom-5 left-1/2 z-20 inline-flex h-11 -translate-x-1/2 items-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white shadow-lg lg:hidden"
        data-testid="shortlets-open-map"
      >
        Map
      </button>
      </div>

      {mobileMapOpen ? (
        <div
          id="shortlets-mobile-map-modal"
          ref={mobileMapDialogRef}
          className="fixed inset-0 z-40 flex flex-col bg-white lg:hidden"
          data-testid="shortlets-mobile-map"
          role="dialog"
          aria-modal="true"
          aria-label="Map results"
          tabIndex={-1}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Map view</p>
            </div>
            <div className="flex items-center gap-2">
              <Button ref={mobileMapPrimaryActionRef} variant="secondary" size="sm" onClick={openListView}>
                Back to results
              </Button>
              <button
                type="button"
                aria-label="Close map"
                onClick={openListView}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
          </div>
          <div className="relative min-h-0" style={{ height: "calc(100vh - 84px)" }}>
            <ShortletsSearchMap
              listings={mapListings}
              selectedListingId={selectedListingId}
              hoveredListingId={hoveredListingId}
              onSelectListing={onSelectListing}
              onHoverListing={onHoverListingFromMap}
              onBoundsChanged={onMapBoundsChanged}
              marketCountry={parsedUi.market}
              resultHash={mapResultHash}
              cameraIntent={cameraIntent}
              cameraIntentNonce={cameraIntentNonce}
              fitRequestKey={mapFitRequestKey}
              resolvedFitRequestKey={resolvedMapFitRequestKey}
              preferredCenter={preferredCenter}
              height="calc(100vh - 84px)"
              invalidateNonce={mobileMapInvalidateNonce}
            />
            {showExploreMapHint ? (
              <div className="pointer-events-none absolute left-0 right-0 top-3 flex justify-center">
                <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
                  Explore the map, then use Search this area.
                </span>
              </div>
            ) : null}
            {!isMapMoveSearchEnabled && searchAreaDirty ? (
              <div className="pointer-events-none absolute left-0 right-0 top-3 flex justify-center">
                <Button className="pointer-events-auto" onClick={onSearchThisArea}>
                  Search this area
                </Button>
              </div>
            ) : null}
            {isBboxApplied ? (
              <div className="pointer-events-none absolute left-3 top-3 flex">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="pointer-events-auto"
                  onClick={clearMapArea}
                >
                  Clear map area
                </Button>
              </div>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
              <div className="flex snap-x gap-3 overflow-x-auto pb-1">
                {filteredItems.map((property) => {
                  const selected = selectedSummary?.id === property.id;
                  const nightlyPrice = resolveShortletNightlyPriceMinor(property);
                  return (
                    <button
                      key={`mobile-map-card-${property.id}`}
                      type="button"
                      onClick={() => onSelectListing(property.id)}
                      className={`w-[260px] shrink-0 snap-start rounded-2xl border p-3 text-left ${
                        selected ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white"
                      }`}
                    >
                      <p className="line-clamp-1 text-sm font-semibold text-slate-900">{property.title}</p>
                      <p className="text-xs text-slate-600">
                        {property.city} · {formatMoney(property.currency, nightlyPrice)}
                      </p>
                      <Link
                        href={buildPropertyHref(property.id)}
                        className="mt-2 inline-flex text-xs font-semibold text-sky-700"
                      >
                        Open listing
                      </Link>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {savedToast ? (
        <div
          className="pointer-events-none fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-lg"
          role="status"
          aria-live="polite"
          data-testid="shortlets-saved-toast"
        >
          {savedToast}
        </div>
      ) : null}
    </div>
  );
}
