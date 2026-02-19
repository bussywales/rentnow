"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Property } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PropertyCardSkeleton } from "@/components/properties/PropertyCardSkeleton";
import { ShortletsSearchMap } from "@/components/shortlets/search/ShortletsSearchMap";
import { ShortletsSearchListCard } from "@/components/shortlets/search/ShortletsSearchListCard";
import {
  isNigeriaDestinationQuery,
  parseSearchView,
  parseShortletSearchBbox,
  parseShortletSearchBounds,
  serializeShortletSearchBbox,
  type ShortletSearchBounds,
} from "@/lib/shortlet/search";
import {
  applyMapViewportChange,
  applySearchThisArea,
  createDefaultShortletAdvancedFilters,
  createShortletMapSearchAreaState,
  formatShortletGuestsLabel,
  isShortletMapMoveSearchEnabled,
  listShortletActiveFilterTags,
  normalizeShortletGuestsParam,
  readShortletAdvancedFiltersFromParams,
  resolveShortletPendingMapAreaLabel,
  resolveShortletResultsLabel,
  removeShortletAdvancedFilterTag,
  resolveShortletMapCameraIntent,
  resolveSelectedListingId,
  isShortletBboxApplied,
  shouldUseCompactShortletSearchPill,
  SHORTLET_QUICK_FILTER_KEYS,
  toggleShortletSearchView,
  writeShortletMapMoveSearchMode,
  type ShortletAdvancedFilterState,
  type ShortletMapMoveSearchMode,
  writeShortletAdvancedFiltersToParams,
} from "@/lib/shortlet/search-ui-state";
import { resolveShortletNightlyPriceMinor } from "@/lib/shortlet/discovery";

type SearchItem = Property & {
  primaryImageUrl?: string | null;
  coverImageUrl?: string | null;
  imageCount?: number;
  imageUrls?: string[];
  verifiedHost?: boolean;
  cancellationPolicy?: "flexible_24h" | "flexible_48h" | "moderate_5d" | "strict";
  cancellationLabel?: string;
  freeCancellation?: boolean;
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
    primaryImageUrl: string | null;
    latitude: number | null;
    longitude: number | null;
  }>;
  nearbyAlternatives: Array<{ label: string; hint: string }>;
};

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

function readQueryParamsFromSearchParams(searchParams: URLSearchParams) {
  const market = (searchParams.get("market") ?? "NG").trim().toUpperCase();
  const guests = normalizeShortletGuestsParam(searchParams.get("guests"));
  const where = searchParams.get("where") ?? searchParams.get("q") ?? "";
  return {
    where,
    checkIn: searchParams.get("checkIn") ?? "",
    checkOut: searchParams.get("checkOut") ?? "",
    guests: String(guests),
    market: /^[A-Z]{2}$/.test(market) ? market : "NG",
    sort: searchParams.get("sort") ?? "recommended",
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

function getMarketCurrency(countryCode: string): string {
  if (countryCode === "NG") return "NGN";
  if (countryCode === "GB") return "GBP";
  if (countryCode === "KE") return "KES";
  if (countryCode === "US") return "USD";
  return "NGN";
}

function normalizeSearchItemImageFields(item: SearchItem): SearchItem {
  const primaryImageUrl = item.primaryImageUrl ?? null;
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
    if (!next.get("market")) next.set("market", parsedUi.market);
    if (!next.get("page")) next.set("page", "1");
    if (!next.get("pageSize")) next.set("pageSize", "24");
    return next;
  }, [parsedUi.market, stableSearchParams]);
  const requestSearchQuery = requestSearchParams.toString();
  const mapFitRequestKey = useMemo(() => {
    const next = new URLSearchParams(requestSearchQuery);
    next.delete("page");
    next.delete("pageSize");
    return next.toString();
  }, [requestSearchQuery]);
  const backLinkQuery = useMemo(() => {
    const next = new URLSearchParams(searchParamsKey);
    if (!next.get("market")) next.set("market", parsedUi.market);
    return next.toString();
  }, [parsedUi.market, searchParamsKey]);

  const [queryDraft, setQueryDraft] = useState(parsedUi.where);
  const [checkInDraft, setCheckInDraft] = useState(parsedUi.checkIn);
  const [checkOutDraft, setCheckOutDraft] = useState(parsedUi.checkOut);
  const [guestsDraft, setGuestsDraft] = useState(parsedUi.guests);

  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null);
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isCompactSearch, setIsCompactSearch] = useState(false);
  const [isSearchHeaderInView, setIsSearchHeaderInView] = useState(true);
  const [quickFiltersCollapsed, setQuickFiltersCollapsed] = useState(false);
  const [quickFiltersPopoverOpen, setQuickFiltersPopoverOpen] = useState(false);
  const [draftAdvancedFilters, setDraftAdvancedFilters] = useState<ShortletAdvancedFilterState>(() =>
    readShortletAdvancedFiltersFromParams(stableSearchParams)
  );

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const whereInputRef = useRef<HTMLInputElement | null>(null);
  const checkInInputRef = useRef<HTMLInputElement | null>(null);
  const checkOutInputRef = useRef<HTMLInputElement | null>(null);
  const guestsInputRef = useRef<HTMLSelectElement | null>(null);
  const expandedSearchHeaderRef = useRef<HTMLDivElement | null>(null);
  const quickFiltersMeasureRef = useRef<HTMLDivElement | null>(null);
  const quickFiltersPopoverRef = useRef<HTMLDivElement | null>(null);
  const mapMoveDebounceRef = useRef<number | null>(null);
  const mobileListScrollYRef = useRef(0);
  const [mobileMapInvalidateNonce, setMobileMapInvalidateNonce] = useState(0);

  useEffect(() => {
    setQueryDraft(parsedUi.where);
    setCheckInDraft(parsedUi.checkIn);
    setCheckOutDraft(parsedUi.checkOut);
    setGuestsDraft(parsedUi.guests);
    setMobileView(parsedUi.view);
    setMobileMapOpen(parsedUi.view === "map");
    setMapMoveSearchMode(parsedUi.mapAutoSearch ? "auto" : "manual");
  }, [parsedUi]);

  useEffect(() => {
    setMapAreaState(createShortletMapSearchAreaState(parsedBounds));
  }, [parsedBounds]);

  useEffect(() => {
    setDraftAdvancedFilters(readShortletAdvancedFiltersFromParams(stableSearchParams));
  }, [stableSearchParams]);

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
        setSelectedListingId((current) => {
          const normalized = typed.items;
          if (current && normalized.some((item) => item.id === current)) return current;
          return normalized[0]?.id ?? null;
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
    return () => {
      if (mapMoveDebounceRef.current !== null) {
        window.clearTimeout(mapMoveDebounceRef.current);
      }
    };
  }, []);

  const updateUrl = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParamsKey);
      mutate(next);
      if (!next.get("market")) next.set("market", parsedUi.market);
      if (!next.get("view")) next.set("view", mobileView);
      next.set("page", "1");
      const query = next.toString();
      if (query === searchParamsKey) return false;
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      return true;
    },
    [mobileView, parsedUi.market, pathname, router, searchParamsKey]
  );

  const onSubmitSearch = () => {
    const intent = resolveShortletMapCameraIntent({
      hasLocationChanged: queryDraft.trim() !== parsedUi.where.trim(),
      hasBoundsChanged: false,
    });
    setCameraIntent(intent);
    setCameraIntentNonce((current) => current + 1);
    updateUrl((next) => {
      if (queryDraft.trim()) next.set("where", queryDraft.trim());
      else next.delete("where");
      next.delete("q");
      if (checkInDraft) next.set("checkIn", checkInDraft);
      else next.delete("checkIn");
      if (checkOutDraft) next.set("checkOut", checkOutDraft);
      else next.delete("checkOut");
      next.set("guests", String(normalizeShortletGuestsParam(guestsDraft)));
    });
  };

  const focusExpandedControl = useCallback(
    (field: "where" | "checkIn" | "checkOut" | "guests") => {
      const inputRef =
        field === "where"
          ? whereInputRef
          : field === "checkIn"
            ? checkInInputRef
            : field === "checkOut"
              ? checkOutInputRef
              : guestsInputRef;
      const target = inputRef.current;
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => target.focus(), 220);
    },
    []
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
    setHoveredListingId(listingId);
    setSelectedListingId((current) =>
      resolveSelectedListingId(current, {
        pinId: listingId,
      })
    );
    const row = cardRefs.current[listingId];
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const onHoverListingFromMap = useCallback((listingId: string | null) => {
    setHoveredListingId(listingId);
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

  const openMapView = () => {
    mobileListScrollYRef.current = window.scrollY;
    const nextView = toggleShortletSearchView("list");
    setMobileView(nextView);
    setMobileMapOpen(true);
    setMobileMapInvalidateNonce((current) => current + 1);
    updateUrl((next) => next.set("view", "map"));
  };

  const openListView = () => {
    const nextView = toggleShortletSearchView("map");
    setMobileView(nextView);
    setMobileMapOpen(false);
    updateUrl((next) => next.set("view", "list"));
    requestAnimationFrame(() => {
      window.scrollTo({ top: mobileListScrollYRef.current, behavior: "auto" });
    });
  };

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

  const mapListings = useMemo(
    () => {
      if (results?.mapItems?.length) {
        return results.mapItems.map((item) => ({
          ...item,
          latitude: typeof item.latitude === "number" ? item.latitude : null,
          longitude: typeof item.longitude === "number" ? item.longitude : null,
        }));
      }
      return (results?.items ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        city: item.city,
        currency: item.currency,
        nightlyPriceMinor: resolveShortletNightlyPriceMinor(item),
        primaryImageUrl: item.primaryImageUrl ?? item.cover_image_url ?? null,
        latitude: typeof item.latitude === "number" ? item.latitude : null,
        longitude: typeof item.longitude === "number" ? item.longitude : null,
      }));
    },
    [results?.items, results?.mapItems]
  );
  const mapResultHash = useMemo(() => {
    const ids = mapListings.map((listing) => listing.id).join(",");
    return `${parsedUi.market}|${mapListings.length}|${ids}`;
  }, [mapListings, parsedUi.market]);

  const selectedSummary = useMemo(() => {
    const match = results?.items.find((item) => item.id === selectedListingId) ?? null;
    if (!match) return null;
    return {
      id: match.id,
      title: match.title,
      city: match.city,
      nightly: formatMoney(match.currency, resolveShortletNightlyPriceMinor(match)),
    };
  }, [results?.items, selectedListingId]);

  const searchAreaDirty = mapAreaState.mapDirty;
  const isMapMoveSearchEnabled = mapMoveSearchMode === "auto";
  const whereSummary = queryDraft.trim() || "Where";
  const datesSummary =
    checkInDraft && checkOutDraft
      ? `${formatCompactDate(checkInDraft)} - ${formatCompactDate(checkOutDraft)}`
      : checkInDraft
        ? `${formatCompactDate(checkInDraft)} - Checkout`
        : "Dates";
  const guestsSummary = formatShortletGuestsLabel(guestsDraft);
  const showCompactSearch = isCompactSearch && !isSearchHeaderInView;
  const isBboxApplied = useMemo(
    () => isShortletBboxApplied(stableSearchParams.get("bbox")),
    [stableSearchParams]
  );
  const resultsLabel = loading
    ? "Loading stays..."
    : resolveShortletResultsLabel({ total: results?.total ?? 0, isBboxApplied });
  const pendingMapAreaLabel = isMapMoveSearchEnabled
    ? mapMoveUpdating || loading
      ? "Updating results..."
      : "Map movement updates results automatically."
    : resolveShortletPendingMapAreaLabel(searchAreaDirty);
  const desktopLayoutClass = desktopMapOpen
    ? "hidden gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    : "hidden gap-4 lg:grid lg:grid-cols-1";
  const desktopCardsGridClass = desktopMapOpen
    ? "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]"
    : "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]";

  const marketCurrency = getMarketCurrency(parsedUi.market);
  const activeDestination = parsedUi.where.trim();
  const heading = activeDestination
    ? isNigeriaDestinationQuery(activeDestination)
      ? "Find shortlets across Nigeria"
      : `Find shortlets in ${activeDestination}`
    : "Find shortlets anywhere";

  return (
    <div className="mx-auto flex w-full max-w-[1200px] min-w-0 flex-col gap-4 px-4 py-4">
      <div
        className={`pointer-events-none fixed inset-x-0 top-20 z-30 flex justify-center px-4 transition-all duration-200 ${
          showCompactSearch ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        }`}
        data-testid="shortlets-compact-search-pill"
        aria-hidden={!showCompactSearch}
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
                <option value="price_low">Price low-high</option>
                <option value="price_high">Price high-low</option>
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
                {appliedFilterCount > 0 ? `Filters (${appliedFilterCount})` : "Filters"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Shortlets</p>
        <h1 className="text-2xl font-semibold text-slate-900">{heading}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Search by area, landmark, and dates. Map prices are nightly and availability-aware.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Prices shown in {marketCurrency}. Market changes pricing context, not destination.
        </p>

        <div
          ref={expandedSearchHeaderRef}
          className="mt-3"
          data-testid="shortlets-expanded-search-controls"
          aria-hidden={showCompactSearch}
        >
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,0.75fr)_auto_auto_minmax(0,0.85fr)]">
          <Input
            ref={whereInputRef}
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
            placeholder="Area, landmark, city"
            aria-label="Where"
            className="h-11"
          />
          <Input
            ref={checkInInputRef}
            type="date"
            value={checkInDraft}
            onChange={(event) => setCheckInDraft(event.target.value)}
            aria-label="Check-in"
            className="h-11"
          />
          <Input
            ref={checkOutInputRef}
            type="date"
            value={checkOutDraft}
            onChange={(event) => setCheckOutDraft(event.target.value)}
            aria-label="Check-out"
            className="h-11"
          />
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
            {appliedFilterCount > 0 ? `Filters (${appliedFilterCount})` : "Filters"}
          </Button>
          <Select
            value={parsedUi.sort}
            onChange={(event) => updateUrl((next) => next.set("sort", event.target.value))}
            className="h-11 min-w-[170px]"
            aria-label="Sort"
          >
            <option value="recommended">Recommended</option>
            <option value="price_low">Price: low to high</option>
            <option value="price_high">Price: high to low</option>
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

          {quickFiltersCollapsed ? (
            <div ref={quickFiltersPopoverRef} className="relative" data-testid="shortlets-quick-filters-collapsed">
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
            </div>
            <div className="flex items-center gap-3">
              {results?.total === 0 && !!parsedUi.checkIn && !!parsedUi.checkOut ? (
                <p className="text-xs text-slate-500">Try nearby dates or expand map area.</p>
              ) : null}
              <label
                className="inline-flex items-center gap-2 text-xs font-medium text-slate-600"
                data-testid="shortlets-map-move-toggle"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  checked={isMapMoveSearchEnabled}
                  onChange={(event) => onToggleMapMoveSearch(event.target.checked)}
                />
                Search as I move the map
              </label>
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
          {loading && !(results?.items.length ?? 0) ? (
            <div className={desktopCardsGridClass}>
              {Array.from({ length: 6 }).map((_, index) => (
                <PropertyCardSkeleton key={`shortlet-list-skeleton-${index}`} />
              ))}
            </div>
          ) : isMapMoveSearchEnabled && loading ? (
            <div className="space-y-2">
              <div className="h-9 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
              <div className={desktopCardsGridClass}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <PropertyCardSkeleton key={`shortlet-auto-skeleton-${index}`} />
                ))}
              </div>
            </div>
          ) : results?.items.length ? (
            <div className={desktopCardsGridClass} data-testid="shortlets-desktop-results-grid">
              {results.items.map((property) => {
                const selected = property.id === selectedListingId;
                const highlighted = selected || property.id === hoveredListingId;
                return (
                  <div
                    key={property.id}
                    ref={(node) => {
                      cardRefs.current[property.id] = node;
                    }}
                    className={`rounded-2xl border ${
                      highlighted ? "border-sky-300 ring-2 ring-sky-100" : "border-transparent"
                    }`}
                    onMouseEnter={() => setHoveredListingId(property.id)}
                    onMouseLeave={() => setHoveredListingId(null)}
                    onClick={() =>
                      setSelectedListingId((current) =>
                        resolveSelectedListingId(current, { cardId: property.id })
                      )
                    }
                  >
                    <ShortletsSearchListCard
                      property={property}
                      href={`/properties/${property.id}?back=${encodeURIComponent(
                        `/shortlets?${backLinkQuery}`
                      )}#cta`}
                      selected={selected}
                      highlighted={property.id === hoveredListingId}
                      onFocus={() => setHoveredListingId(property.id)}
                      onBlur={() => setHoveredListingId(null)}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">No shortlets found for this search.</p>
              <p className="mt-1">Try nearby dates, remove some filters, or expand the map area.</p>
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
              height="min(76vh, 800px)"
              invalidateNonce={0}
            />
            {!isMapMoveSearchEnabled && searchAreaDirty ? (
              <div className="pointer-events-none absolute left-0 right-0 top-3 flex justify-center">
                <Button className="pointer-events-auto" onClick={onSearchThisArea}>
                  Search this area
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
        </div>
        {loading && !(results?.items.length ?? 0) ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <PropertyCardSkeleton key={`shortlet-mobile-skeleton-${index}`} />
            ))}
          </div>
        ) : results?.items.length ? (
          <div className="grid gap-3">
            {results.items.map((property) => {
              const selected = property.id === selectedListingId;
              const highlighted = selected || property.id === hoveredListingId;
              return (
                <div
                  key={property.id}
                  ref={(node) => {
                    cardRefs.current[property.id] = node;
                  }}
                  className={`rounded-2xl border ${
                    highlighted ? "border-sky-300 ring-2 ring-sky-100" : "border-transparent"
                  }`}
                  onClick={() =>
                    setSelectedListingId((current) =>
                      resolveSelectedListingId(current, { cardId: property.id })
                    )
                  }
                  onMouseEnter={() => setHoveredListingId(property.id)}
                  onMouseLeave={() => setHoveredListingId(null)}
                >
                  <ShortletsSearchListCard
                    property={property}
                    href={`/properties/${property.id}?back=${encodeURIComponent(
                      `/shortlets?${backLinkQuery}`
                    )}#cta`}
                    selected={selected}
                    highlighted={property.id === hoveredListingId}
                    onFocus={() => setHoveredListingId(property.id)}
                    onBlur={() => setHoveredListingId(null)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No shortlets found for this search.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={openMapView}
        className="fixed bottom-5 left-1/2 z-20 inline-flex h-11 -translate-x-1/2 items-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white shadow-lg lg:hidden"
      >
        Map
      </button>

      {mobileMapOpen ? (
        <div className="fixed inset-0 z-40 flex flex-col bg-white lg:hidden" data-testid="shortlets-mobile-map">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Map view</p>
              <label className="mt-1 inline-flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  checked={isMapMoveSearchEnabled}
                  onChange={(event) => onToggleMapMoveSearch(event.target.checked)}
                />
                Search as I move the map
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={openListView}>
                List
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
              height="calc(100vh - 84px)"
              invalidateNonce={mobileMapInvalidateNonce}
            />
            {!isMapMoveSearchEnabled && searchAreaDirty ? (
              <div className="pointer-events-none absolute left-0 right-0 top-3 flex justify-center">
                <Button className="pointer-events-auto" onClick={onSearchThisArea}>
                  Search this area
                </Button>
              </div>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
              <div className="flex snap-x gap-3 overflow-x-auto pb-1">
                {(results?.items ?? []).map((property) => {
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
                        href={`/properties/${property.id}?back=${encodeURIComponent(
                          `/shortlets?${backLinkQuery}`
                        )}#cta`}
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
    </div>
  );
}
