"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import {
  resolveIntentForMarket,
  writeStoredIntentForMarket,
  type MobileQuickSearchIntent,
} from "@/lib/home/mobile-quicksearch-intent";
import {
  MOBILE_QUICKSEARCH_CATEGORY_OPTIONS,
  buildMobileQuickSearchPresetList,
  type MobileQuickSearchCategory,
  type MobileQuickSearchPreset,
} from "@/lib/home/mobile-quicksearch-presets";
import { buildMobileQuickSearchHref } from "@/lib/home/mobile-featured-discovery";
import { getRecentBrowseIntent } from "@/lib/market/browse-intent";
import {
  resolvePropertiesBrowseCategory,
} from "@/lib/properties/browse-categories";
import { clearRecentSearches, getRecentSearches, pushRecentSearch } from "@/lib/search/recents";
import {
  isDateKey,
  resolveDateQuickPickRange,
  type MobileQuickSearchDateQuickPick,
} from "@/lib/search/date-quick-picks";
import { readRecentSearchPresets, type ShortletSearchPreset } from "@/lib/shortlet/search-presets";

const MOBILE_QUICKSEARCH_RECENTS_KEY = "mobile_quicksearch_v1";
const MOBILE_QUICKSEARCH_RECENTS_LIMIT = 5;

const QUICKSEARCH_INTENT_OPTIONS: Array<{ key: MobileQuickSearchIntent; label: string }> = [
  { key: "shortlet", label: "Shortlet" },
  { key: "rent", label: "Rent" },
  { key: "buy", label: "Buy" },
];

const DATE_PICK_OPTIONS: Array<{ key: MobileQuickSearchDateQuickPick; label: string }> = [
  { key: "this_weekend", label: "This weekend" },
  { key: "next_weekend", label: "Next weekend" },
  { key: "flexible", label: "Flexible" },
];

function resolveQuickSearchCategory(
  lastSearchParams: string | null | undefined
): MobileQuickSearchCategory {
  if (!lastSearchParams) return "rent";
  const params = new URLSearchParams(lastSearchParams);
  return resolvePropertiesBrowseCategory({
    categoryParam: params.get("category"),
    intentParam: params.get("intent"),
    stayParam: params.get("stay"),
    listingIntentParam: params.get("listingIntent"),
  });
}

function resolveQuickSearchLocation(lastSearchParams: string | null | undefined): string {
  if (!lastSearchParams) return "";
  const params = new URLSearchParams(lastSearchParams);
  return params.get("city")?.trim() ?? "";
}

function resolveIntentFromCategory(category: MobileQuickSearchCategory): MobileQuickSearchIntent {
  if (category === "shortlet") return "shortlet";
  if (category === "buy" || category === "off_plan") return "buy";
  return "rent";
}

function resolveCategoryFromIntent(intent: MobileQuickSearchIntent): MobileQuickSearchCategory {
  if (intent === "shortlet") return "shortlet";
  if (intent === "buy") return "buy";
  return "rent";
}

function formatDateRangeSummary(checkIn: string, checkOut: string): string {
  if (!checkIn || !checkOut) return "Any dates";
  return `${checkIn} - ${checkOut}`;
}

function normalizeGuests(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(12, Math.trunc(value)));
}

type MobileQuickSearchSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MobileQuickSearchSheet({ open, onOpenChange }: MobileQuickSearchSheetProps) {
  const router = useRouter();
  const { market } = useMarketPreference();
  const marketCountry = market.country;
  const initialState = useMemo(() => {
    const marketIntent = resolveIntentForMarket(marketCountry);
    const defaultCategory = resolveCategoryFromIntent(marketIntent);
    if (typeof window === "undefined") {
      return { category: defaultCategory, city: "" };
    }
    const recentIntent = getRecentBrowseIntent(14);
    const lastSearchParams = recentIntent?.lastSearchParams ?? null;
    return {
      category: lastSearchParams ? resolveQuickSearchCategory(lastSearchParams) : defaultCategory,
      city: resolveQuickSearchLocation(lastSearchParams),
    };
  }, [marketCountry]);
  const [category, setCategory] = useState<MobileQuickSearchCategory>(initialState.category);
  const [city, setCity] = useState(initialState.city);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [selectedShortletParams, setSelectedShortletParams] = useState<Record<string, string> | null>(null);
  const [dateQuickPick, setDateQuickPick] = useState<MobileQuickSearchDateQuickPick>("flexible");
  const [checkInDraft, setCheckInDraft] = useState("");
  const [checkOutDraft, setCheckOutDraft] = useState("");
  const [guestsDraft, setGuestsDraft] = useState(1);
  const shortletRecentPresets = useMemo<ShortletSearchPreset[]>(() => {
    if (!open || typeof window === "undefined") return [];
    return readRecentSearchPresets().slice(0, 4);
  }, [open]);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    getRecentSearches(MOBILE_QUICKSEARCH_RECENTS_KEY, MOBILE_QUICKSEARCH_RECENTS_LIMIT)
  );
  const locationInputRef = useRef<HTMLInputElement | null>(null);
  const presetOptions = useMemo(
    () =>
      buildMobileQuickSearchPresetList({
        category,
        shortletRecents: shortletRecentPresets,
      }),
    [category, shortletRecentPresets]
  );

  const activeIntent = resolveIntentFromCategory(category);
  const isShortletIntent = activeIntent === "shortlet";
  const dateSummary = formatDateRangeSummary(checkInDraft, checkOutDraft);

  const searchHref = useMemo(
    () =>
      buildMobileQuickSearchHref({
        category,
        city,
        shortletParams: selectedShortletParams,
        intent: activeIntent,
        guests: guestsDraft,
        checkIn: checkInDraft,
        checkOut: checkOutDraft,
      }),
    [
      activeIntent,
      category,
      checkInDraft,
      checkOutDraft,
      city,
      guestsDraft,
      selectedShortletParams,
    ]
  );

  useEffect(() => {
    if (!open) return;
    const rafId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        locationInputRef.current?.focus();
      });
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [open]);

  const handleSearch = () => {
    const nextRecents = pushRecentSearch(
      MOBILE_QUICKSEARCH_RECENTS_KEY,
      city,
      MOBILE_QUICKSEARCH_RECENTS_LIMIT
    );
    setRecentSearches(nextRecents);
    onOpenChange(false);
    router.push(searchHref);
  };

  const applyIntent = (intent: MobileQuickSearchIntent) => {
    writeStoredIntentForMarket(marketCountry, intent);
    setCategory(resolveCategoryFromIntent(intent));
    setActivePresetId(null);
    setSelectedShortletParams(null);
  };

  const applyDateQuickPick = (pick: MobileQuickSearchDateQuickPick) => {
    setDateQuickPick(pick);
    if (pick === "flexible") {
      setCheckInDraft("");
      setCheckOutDraft("");
      return;
    }
    const range = resolveDateQuickPickRange(pick, new Date());
    if (!range) {
      setCheckInDraft("");
      setCheckOutDraft("");
      return;
    }
    setCheckInDraft(range.checkIn);
    setCheckOutDraft(range.checkOut);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Start your search"
      description="Pick intent, dates, guests, and location to jump into results."
    >
      <form
        className="space-y-4"
        data-testid="mobile-quicksearch-sheet"
        onSubmit={(event) => {
          event.preventDefault();
          handleSearch();
        }}
      >
        <div className="space-y-1.5" data-testid="mobile-quicksearch-intent-rail">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Intent</p>
          <div className="flex flex-wrap gap-2">
            {QUICKSEARCH_INTENT_OPTIONS.map((option) => {
              const active = activeIntent === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => applyIntent(option.key)}
                  data-testid={`mobile-quicksearch-intent-${option.key}`}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  aria-pressed={active}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2" data-testid="mobile-quicksearch-category-rail">
          {MOBILE_QUICKSEARCH_CATEGORY_OPTIONS.map((option) => {
            const active = category === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  writeStoredIntentForMarket(marketCountry, resolveIntentFromCategory(option.key));
                  setCategory(option.key);
                  setActivePresetId(null);
                  setSelectedShortletParams(null);
                }}
                data-testid={`mobile-quicksearch-category-${option.key}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                aria-pressed={active}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {presetOptions.length > 0 ? (
          <div className="space-y-2" data-testid="mobile-quicksearch-presets">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Quick picks</p>
            <div className="scrollbar-none -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
              {presetOptions.map((preset: MobileQuickSearchPreset) => {
                const isActive = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`mobile-quicksearch-preset-${preset.id}`}
                    className={`inline-flex snap-start shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? "border-sky-600 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    onClick={() => {
                      writeStoredIntentForMarket(
                        marketCountry,
                        resolveIntentFromCategory(preset.category)
                      );
                      setCategory(preset.category);
                      setActivePresetId(preset.id);
                      setSelectedShortletParams(preset.shortletParams ?? null);
                      if (preset.city) {
                        setCity(preset.city);
                      }
                      const presetGuests = Number(preset.shortletParams?.guests ?? "1");
                      setGuestsDraft(normalizeGuests(presetGuests));
                      const presetCheckIn = preset.shortletParams?.checkIn ?? "";
                      const presetCheckOut = preset.shortletParams?.checkOut ?? "";
                      if (isDateKey(presetCheckIn) && isDateKey(presetCheckOut)) {
                        setCheckInDraft(presetCheckIn);
                        setCheckOutDraft(presetCheckOut);
                        setDateQuickPick("flexible");
                      }
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5" data-testid="mobile-quicksearch-dates">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dates</p>
            <p className="text-[11px] text-slate-500" data-testid="mobile-quicksearch-date-summary">
              {dateSummary}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {DATE_PICK_OPTIONS.map((option) => {
              const active = dateQuickPick === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  disabled={!isShortletIntent}
                  data-testid={`mobile-quicksearch-date-${option.key.replaceAll("_", "-")}`}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                  aria-pressed={active}
                  onClick={() => applyDateQuickPick(option.key)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {!isShortletIntent ? (
            <p className="text-[11px] text-slate-500">Dates apply to shortlet stays.</p>
          ) : null}
        </div>

        <div className="space-y-1.5" data-testid="mobile-quicksearch-guests">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Guests</p>
            <p className="text-sm font-semibold text-slate-900" data-testid="mobile-quicksearch-guests-value">
              {guestsDraft}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!isShortletIntent || guestsDraft <= 1}
              data-testid="mobile-quicksearch-guests-decrement"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setGuestsDraft((value) => normalizeGuests(value - 1))}
            >
              -
            </button>
            <button
              type="button"
              disabled={!isShortletIntent || guestsDraft >= 12}
              data-testid="mobile-quicksearch-guests-increment"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setGuestsDraft((value) => normalizeGuests(value + 1))}
            >
              +
            </button>
            {!isShortletIntent ? (
              <p className="text-[11px] text-slate-500">Guests apply to shortlet stays.</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="mobile-quicksearch-location" className="text-xs font-semibold text-slate-700">
            Location
          </label>
          <Input
            id="mobile-quicksearch-location"
            ref={locationInputRef}
            value={city}
            onChange={(event) => {
              const nextCity = event.target.value;
              setCity(nextCity);
              if (category === "shortlet" && selectedShortletParams) {
                setSelectedShortletParams((current) =>
                  current ? { ...current, where: nextCity } : current
                );
              }
            }}
            placeholder="City or area"
            data-testid="mobile-quicksearch-location-input"
            className="rounded-xl border-slate-200"
          />
        </div>

        {recentSearches.length > 0 ? (
          <div className="space-y-2" data-testid="mobile-quicksearch-recents">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent</p>
              <button
                type="button"
                data-testid="mobile-quicksearch-recents-clear"
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                onClick={() => {
                  clearRecentSearches(MOBILE_QUICKSEARCH_RECENTS_KEY);
                  setRecentSearches([]);
                }}
              >
                Clear
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((recent) => (
                <button
                  key={recent}
                  type="button"
                  data-testid="mobile-quicksearch-recent-item"
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                  onClick={() => {
                    setCity(recent);
                    locationInputRef.current?.focus();
                  }}
                >
                  {recent}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2">
          <Button type="submit" data-testid="mobile-quicksearch-search">
            Search
          </Button>
          <Link
            href="/shortlets"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
            data-testid="mobile-quicksearch-shortlets"
          >
            Search shortlets instead
          </Link>
        </div>
      </form>
    </BottomSheet>
  );
}
