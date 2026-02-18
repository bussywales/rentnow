"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Property } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyCardSkeleton } from "@/components/properties/PropertyCardSkeleton";
import { ShortletsSearchMap } from "@/components/shortlets/search/ShortletsSearchMap";
import {
  parseSearchView,
  parseShortletSearchBounds,
  serializeShortletSearchBounds,
  type ShortletSearchBounds,
} from "@/lib/shortlet/search";
import {
  applyMapViewportChange,
  applySearchThisArea,
  createDefaultShortletAdvancedFilters,
  createShortletMapSearchAreaState,
  listShortletActiveFilterTags,
  readShortletAdvancedFiltersFromParams,
  removeShortletAdvancedFilterTag,
  resolveSelectedListingId,
  SHORTLET_QUICK_FILTER_KEYS,
  toggleShortletSearchView,
  type ShortletAdvancedFilterState,
  writeShortletAdvancedFiltersToParams,
} from "@/lib/shortlet/search-ui-state";
import { resolveShortletNightlyPriceMinor } from "@/lib/shortlet/discovery";

type SearchResponse = {
  ok: boolean;
  page: number;
  pageSize: number;
  total: number;
  items: Array<
    Property & {
      coverImageUrl?: string | null;
      imageCount?: number;
      imageUrls?: string[];
    }
  >;
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
  return {
    q: searchParams.get("q") ?? "",
    checkIn: searchParams.get("checkIn") ?? "",
    checkOut: searchParams.get("checkOut") ?? "",
    guests: searchParams.get("guests") ?? "1",
    market: /^[A-Z]{2}$/.test(market) ? market : "NG",
    sort: searchParams.get("sort") ?? "recommended",
    bookingMode: searchParams.get("bookingMode") ?? "",
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
  if (typeof nightlyMinor !== "number" || nightlyMinor <= 0) return "Nightly price unavailable";
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

function normalizeSearchItemImageFields(item: SearchResponse["items"][number]): Property {
  const coverImageUrl = item.coverImageUrl ?? item.cover_image_url ?? null;
  const images =
    item.images ??
    (item.imageUrls ?? []).map((imageUrl, index) => ({
      id: `${item.id}-image-${index}`,
      image_url: imageUrl,
    }));

  return {
    ...item,
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
    () => parseShortletSearchBounds(stableSearchParams.get("bounds")),
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

  const [queryDraft, setQueryDraft] = useState(parsedUi.q);
  const [checkInDraft, setCheckInDraft] = useState(parsedUi.checkIn);
  const [checkOutDraft, setCheckOutDraft] = useState(parsedUi.checkOut);
  const [guestsDraft, setGuestsDraft] = useState(parsedUi.guests);

  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">(parsedUi.view);
  const [mapAreaState, setMapAreaState] = useState(() => createShortletMapSearchAreaState(parsedBounds));
  const [mobileMapOpen, setMobileMapOpen] = useState(parsedUi.view === "map");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftAdvancedFilters, setDraftAdvancedFilters] = useState<ShortletAdvancedFilterState>(() =>
    readShortletAdvancedFiltersFromParams(stableSearchParams)
  );

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setQueryDraft(parsedUi.q);
    setCheckInDraft(parsedUi.checkIn);
    setCheckOutDraft(parsedUi.checkOut);
    setGuestsDraft(parsedUi.guests);
    setMobileView(parsedUi.view);
    setMobileMapOpen(parsedUi.view === "map");
  }, [parsedUi]);

  useEffect(() => {
    setMapAreaState(createShortletMapSearchAreaState(parsedBounds));
  }, [parsedBounds]);

  useEffect(() => {
    setDraftAdvancedFilters(readShortletAdvancedFiltersFromParams(stableSearchParams));
  }, [stableSearchParams]);

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
        setSelectedListingId((current) => {
          const normalized = typed.items;
          if (current && normalized.some((item) => item.id === current)) return current;
          return normalized[0]?.id ?? null;
        });
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : "Unable to fetch shortlets.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void run();
    return () => controller.abort();
  }, [requestSearchQuery]);

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

  const updateUrl = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParamsKey);
      mutate(next);
      if (!next.get("market")) next.set("market", parsedUi.market);
      if (!next.get("view")) next.set("view", mobileView);
      next.set("page", "1");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [mobileView, parsedUi.market, pathname, router, searchParamsKey]
  );

  const onSubmitSearch = () => {
    updateUrl((next) => {
      if (queryDraft.trim()) next.set("q", queryDraft.trim());
      else next.delete("q");
      if (checkInDraft) next.set("checkIn", checkInDraft);
      else next.delete("checkIn");
      if (checkOutDraft) next.set("checkOut", checkOutDraft);
      else next.delete("checkOut");
      const guests = Number(guestsDraft);
      if (Number.isFinite(guests) && guests > 0) next.set("guests", String(Math.trunc(guests)));
      else next.delete("guests");
    });
  };

  const applyAdvancedFilters = useCallback(
    (filters: ShortletAdvancedFilterState) => {
      updateUrl((next) => {
        writeShortletAdvancedFiltersToParams(next, filters);
      });
    },
    [updateUrl]
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

  const onSelectListing = (listingId: string) => {
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

  const openFiltersDrawer = () => {
    setDraftAdvancedFilters(readShortletAdvancedFiltersFromParams(stableSearchParams));
    setFiltersOpen(true);
  };

  const openMapView = () => {
    const nextView = toggleShortletSearchView("list");
    setMobileView(nextView);
    setMobileMapOpen(true);
    updateUrl((next) => next.set("view", "map"));
  };

  const openListView = () => {
    const nextView = toggleShortletSearchView("map");
    setMobileView(nextView);
    setMobileMapOpen(false);
    updateUrl((next) => next.set("view", "list"));
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
  const activeFilterTags = useMemo(
    () => listShortletActiveFilterTags(appliedAdvancedFilters),
    [appliedAdvancedFilters]
  );
  const appliedFilterCount = activeFilterTags.length;
  const visibleFilterTags = activeFilterTags.slice(0, 3);
  const hiddenFilterTagCount = Math.max(0, activeFilterTags.length - visibleFilterTags.length);

  const mapListings = useMemo(
    () =>
      (results?.items ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        currency: item.currency,
        nightlyPriceMinor: resolveShortletNightlyPriceMinor(item),
        latitude: typeof item.latitude === "number" ? item.latitude : null,
        longitude: typeof item.longitude === "number" ? item.longitude : null,
      })),
    [results?.items]
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

  return (
    <div className="mx-auto flex w-full max-w-[1200px] min-w-0 flex-col gap-4 px-4 py-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Shortlets</p>
        <h1 className="text-2xl font-semibold text-slate-900">Find shortlets across Nigeria</h1>
        <p className="mt-1 text-sm text-slate-600">
          Search by area, landmark, and dates. Map prices are nightly and availability-aware.
        </p>

        <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,0.65fr)_auto_auto_minmax(0,0.85fr)]">
          <Input
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
            placeholder="Area, landmark, city"
            aria-label="Where"
            className="h-11"
          />
          <Input
            type="date"
            value={checkInDraft}
            onChange={(event) => setCheckInDraft(event.target.value)}
            aria-label="Check-in"
            className="h-11"
          />
          <Input
            type="date"
            value={checkOutDraft}
            onChange={(event) => setCheckOutDraft(event.target.value)}
            aria-label="Check-out"
            className="h-11"
          />
          <Input
            type="number"
            min={1}
            value={guestsDraft}
            onChange={(event) => setGuestsDraft(event.target.value)}
            aria-label="Guests"
            placeholder="Guests"
            className="h-11"
          />
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

        <div
          className="mt-3 flex min-w-0 items-center gap-2 overflow-x-auto whitespace-nowrap pb-1"
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

        {activeFilterTags.length > 0 ? (
          <div
            className="mt-2 flex min-w-0 items-center gap-2 overflow-hidden"
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

      <div className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {loading ? "Loading stays..." : `${results?.total ?? 0} stays found`}
            </p>
            {results?.total === 0 && !!parsedUi.checkIn && !!parsedUi.checkOut ? (
              <p className="text-xs text-slate-500">Try nearby dates or expand map area.</p>
            ) : null}
          </div>
          {loading && !(results?.items.length ?? 0) ? (
            <div className="grid gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <PropertyCardSkeleton key={`shortlet-list-skeleton-${index}`} />
              ))}
            </div>
          ) : results?.items.length ? (
            <div className="grid gap-3">
              {results.items.map((property) => {
                const selected = property.id === selectedListingId;
                return (
                  <div
                    key={property.id}
                    ref={(node) => {
                      cardRefs.current[property.id] = node;
                    }}
                    onMouseEnter={() =>
                      setSelectedListingId((current) =>
                        resolveSelectedListingId(current, { cardId: property.id })
                      )
                    }
                    className={`rounded-2xl border ${
                      selected ? "border-sky-300 ring-2 ring-sky-100" : "border-transparent"
                    }`}
                  >
                    <PropertyCard
                      property={property}
                      href={`/properties/${property.id}?back=${encodeURIComponent(
                        `/shortlets?${backLinkQuery}`
                      )}#cta`}
                      showSave
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

        <section className="sticky top-20 h-fit">
          <div className="relative">
            <ShortletsSearchMap
              listings={mapListings}
              selectedListingId={selectedListingId}
              onSelectListing={onSelectListing}
              onBoundsChanged={(bounds) =>
                setMapAreaState((current) => applyMapViewportChange(current, bounds as ShortletSearchBounds))
              }
              marketCountry={parsedUi.market}
              resultHash={mapResultHash}
              fitRequestKey={mapFitRequestKey}
              height="min(76vh, 800px)"
            />
            {searchAreaDirty ? (
              <div className="pointer-events-none absolute left-0 right-0 top-3 flex justify-center">
                <Button
                  className="pointer-events-auto"
                  onClick={() => {
                    setMapAreaState((current) => {
                      const next = applySearchThisArea(current);
                      const encoded = serializeShortletSearchBounds(next.activeBounds);
                      updateUrl((params) => {
                        if (encoded) params.set("bounds", encoded);
                        else params.delete("bounds");
                      });
                      return next;
                    });
                  }}
                >
                  Search this area
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="space-y-3 lg:hidden">
        <p className="text-sm text-slate-600">
          {loading ? "Loading stays..." : `${results?.total ?? 0} stays found`}
        </p>
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
              return (
                <div
                  key={property.id}
                  ref={(node) => {
                    cardRefs.current[property.id] = node;
                  }}
                  className={`rounded-2xl border ${
                    selected ? "border-sky-300 ring-2 ring-sky-100" : "border-transparent"
                  }`}
                  onClick={() =>
                    setSelectedListingId((current) =>
                      resolveSelectedListingId(current, { cardId: property.id })
                    )
                  }
                >
                  <PropertyCard
                    property={property}
                    href={`/properties/${property.id}?back=${encodeURIComponent(
                      `/shortlets?${backLinkQuery}`
                    )}#cta`}
                    showSave
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
        className="fixed bottom-5 right-4 z-20 inline-flex h-11 items-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white shadow-lg lg:hidden"
      >
        Map
      </button>

      {mobileMapOpen ? (
        <div className="fixed inset-0 z-40 flex flex-col bg-white lg:hidden" data-testid="shortlets-mobile-map">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Map view</p>
            <Button variant="secondary" size="sm" onClick={openListView}>
              List
            </Button>
          </div>
          <div className="relative min-h-0 flex-1">
            <ShortletsSearchMap
              listings={mapListings}
              selectedListingId={selectedListingId}
              onSelectListing={onSelectListing}
              onBoundsChanged={(bounds) =>
                setMapAreaState((current) => applyMapViewportChange(current, bounds as ShortletSearchBounds))
              }
              marketCountry={parsedUi.market}
              resultHash={mapResultHash}
              fitRequestKey={mapFitRequestKey}
              height="100%"
            />
            {searchAreaDirty ? (
              <div className="pointer-events-none absolute left-0 right-0 top-3 flex justify-center">
                <Button
                  className="pointer-events-auto"
                  onClick={() => {
                    setMapAreaState((current) => {
                      const next = applySearchThisArea(current);
                      const encoded = serializeShortletSearchBounds(next.activeBounds);
                      updateUrl((params) => {
                        if (encoded) params.set("bounds", encoded);
                        else params.delete("bounds");
                      });
                      return next;
                    });
                  }}
                >
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
