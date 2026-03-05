"use client";

import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/components/ui/cn";
import { glassSurface } from "@/lib/ui/glass";

export type ExploreV2MarketFilter = "all" | "ng" | "gb" | "ca" | "us";
export type ExploreV2TypeFilter = "all" | "rent" | "buy" | "shortlets";
export type ExploreV2BedsFilter = "any" | "1" | "2" | "3" | "4";

export type ExploreV2Filters = {
  market: ExploreV2MarketFilter;
  type: ExploreV2TypeFilter;
  beds: ExploreV2BedsFilter;
  budgetMin: number | null;
  budgetMax: number | null;
};

type ExploreV2HeaderProps = {
  filters: ExploreV2Filters;
  defaultMarket: ExploreV2MarketFilter;
  fallbackCurrency: string | null;
  onApplyFilters: (next: ExploreV2Filters) => void;
  onClearAll: () => void;
};

type ExploreV2SheetKind = "market" | "type" | "beds" | "budget" | null;

type ExploreV2BudgetPreset = {
  id: string;
  label: string;
  min: number | null;
  max: number | null;
};

const MARKET_OPTIONS: Array<{ value: ExploreV2MarketFilter; label: string }> = [
  { value: "all", label: "All markets" },
  { value: "ng", label: "NG" },
  { value: "gb", label: "GB" },
  { value: "ca", label: "CA" },
  { value: "us", label: "US" },
];

const TYPE_OPTIONS: Array<{ value: ExploreV2TypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "rent", label: "Rent" },
  { value: "buy", label: "Buy" },
  { value: "shortlets", label: "Shortlets" },
];

const BEDS_OPTIONS: Array<{ value: ExploreV2BedsFilter; label: string }> = [
  { value: "any", label: "Any" },
  { value: "1", label: "1+" },
  { value: "2", label: "2+" },
  { value: "3", label: "3+" },
  { value: "4", label: "4+" },
];

const MARKET_TO_CURRENCY: Record<Exclude<ExploreV2MarketFilter, "all">, string> = {
  ng: "NGN",
  gb: "GBP",
  ca: "CAD",
  us: "USD",
};

const BUDGET_PRESETS_BY_MARKET: Record<Exclude<ExploreV2MarketFilter, "all">, ExploreV2BudgetPreset[]> = {
  ng: [
    { id: "any", label: "Any budget", min: null, max: null },
    { id: "under-500k", label: "Under ₦500k", min: null, max: 500_000 },
    { id: "500k-1m", label: "₦500k - ₦1m", min: 500_000, max: 1_000_000 },
    { id: "1m-2m", label: "₦1m - ₦2m", min: 1_000_000, max: 2_000_000 },
    { id: "2m+", label: "₦2m+", min: 2_000_000, max: null },
  ],
  gb: [
    { id: "any", label: "Any budget", min: null, max: null },
    { id: "under-1k", label: "Under £1,000", min: null, max: 1_000 },
    { id: "1k-2k", label: "£1,000 - £2,000", min: 1_000, max: 2_000 },
    { id: "2k-3k", label: "£2,000 - £3,000", min: 2_000, max: 3_000 },
    { id: "3k+", label: "£3,000+", min: 3_000, max: null },
  ],
  ca: [
    { id: "any", label: "Any budget", min: null, max: null },
    { id: "under-2k", label: "Under C$2,000", min: null, max: 2_000 },
    { id: "2k-3k", label: "C$2,000 - C$3,000", min: 2_000, max: 3_000 },
    { id: "3k-5k", label: "C$3,000 - C$5,000", min: 3_000, max: 5_000 },
    { id: "5k+", label: "C$5,000+", min: 5_000, max: null },
  ],
  us: [
    { id: "any", label: "Any budget", min: null, max: null },
    { id: "under-1500", label: "Under $1,500", min: null, max: 1_500 },
    { id: "1500-2500", label: "$1,500 - $2,500", min: 1_500, max: 2_500 },
    { id: "2500-4000", label: "$2,500 - $4,000", min: 2_500, max: 4_000 },
    { id: "4k+", label: "$4,000+", min: 4_000, max: null },
  ],
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: "₦",
  GBP: "£",
  CAD: "C$",
  USD: "$",
};

const TYPE_LABELS: Record<ExploreV2TypeFilter, string> = {
  all: "All types",
  rent: "Rent",
  buy: "Buy",
  shortlets: "Shortlets",
};

const BEDS_LABELS: Record<ExploreV2BedsFilter, string> = {
  any: "Any beds",
  "1": "1+ beds",
  "2": "2+ beds",
  "3": "3+ beds",
  "4": "4+ beds",
};

export function normalizeExploreV2MarketFilter(input: string | null | undefined): ExploreV2MarketFilter {
  if (typeof input !== "string") return "all";
  const normalized = input.trim().toLowerCase();
  if (normalized === "ng" || normalized === "gb" || normalized === "ca" || normalized === "us") {
    return normalized;
  }
  return "all";
}

export function createExploreV2DefaultFilters(defaultMarket: ExploreV2MarketFilter): ExploreV2Filters {
  return {
    market: defaultMarket === "all" ? "all" : defaultMarket,
    type: "all",
    beds: "any",
    budgetMin: null,
    budgetMax: null,
  };
}

export function hasExploreV2ActiveFilters(
  filters: ExploreV2Filters,
  defaultMarket: ExploreV2MarketFilter
): boolean {
  const baseline = createExploreV2DefaultFilters(defaultMarket);
  return (
    filters.market !== baseline.market ||
    filters.type !== baseline.type ||
    filters.beds !== baseline.beds ||
    filters.budgetMin !== null ||
    filters.budgetMax !== null
  );
}

function resolveExploreV2BudgetCurrency(filters: ExploreV2Filters, fallbackCurrency: string | null): string {
  if (filters.market === "all") return (fallbackCurrency || "USD").toUpperCase();
  return MARKET_TO_CURRENCY[filters.market];
}

function formatExploreV2BudgetAmount(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)}`;
}

export function resolveExploreV2BudgetSummary(
  filters: ExploreV2Filters,
  fallbackCurrency: string | null
): string {
  if (filters.budgetMin === null && filters.budgetMax === null) return "Any budget";
  if (filters.market === "all") return "Any budget";
  const currency = resolveExploreV2BudgetCurrency(filters, fallbackCurrency);
  if (filters.budgetMin !== null && filters.budgetMax !== null) {
    return `${formatExploreV2BudgetAmount(filters.budgetMin, currency)}-${formatExploreV2BudgetAmount(filters.budgetMax, currency)}`;
  }
  if (filters.budgetMin !== null) {
    return `${formatExploreV2BudgetAmount(filters.budgetMin, currency)}+`;
  }
  if (filters.budgetMax !== null) {
    return `Under ${formatExploreV2BudgetAmount(filters.budgetMax, currency)}`;
  }
  return "Any budget";
}

export function resolveExploreV2FilterSummary(
  filters: ExploreV2Filters,
  fallbackCurrency: string | null
): string {
  const marketLabel = filters.market === "all" ? "All markets" : filters.market.toUpperCase();
  return [
    marketLabel,
    TYPE_LABELS[filters.type],
    BEDS_LABELS[filters.beds],
    resolveExploreV2BudgetSummary(filters, fallbackCurrency),
  ].join(" • ");
}

function resolveMarketChipLabel(filters: ExploreV2Filters): string {
  return filters.market === "all" ? "Market: All" : `Market: ${filters.market.toUpperCase()}`;
}

function resolveTypeChipLabel(filters: ExploreV2Filters): string {
  if (filters.type === "all") return "Type: All";
  return `Type: ${TYPE_LABELS[filters.type]}`;
}

function resolveBedsChipLabel(filters: ExploreV2Filters): string {
  if (filters.beds === "any") return "Beds: Any";
  return `Beds: ${filters.beds}+`;
}

function resolveBudgetChipLabel(filters: ExploreV2Filters, fallbackCurrency: string | null): string {
  const summary = resolveExploreV2BudgetSummary(filters, fallbackCurrency);
  return summary === "Any budget" ? "Budget: Any" : summary;
}

function resolveBudgetPresets(filters: ExploreV2Filters): ExploreV2BudgetPreset[] {
  if (filters.market === "all") {
    return [{ id: "any", label: "Any budget", min: null, max: null }];
  }
  return BUDGET_PRESETS_BY_MARKET[filters.market];
}

function isBudgetPresetSelected(filters: ExploreV2Filters, preset: ExploreV2BudgetPreset): boolean {
  return filters.budgetMin === preset.min && filters.budgetMax === preset.max;
}

export function ExploreV2Header({
  filters,
  defaultMarket,
  fallbackCurrency,
  onApplyFilters,
  onClearAll,
}: ExploreV2HeaderProps) {
  const [openSheet, setOpenSheet] = useState<ExploreV2SheetKind>(null);
  const [draftFilters, setDraftFilters] = useState<ExploreV2Filters>(filters);
  const hasActiveFilters = useMemo(
    () => hasExploreV2ActiveFilters(filters, defaultMarket),
    [defaultMarket, filters]
  );
  const subtitle = useMemo(
    () => resolveExploreV2FilterSummary(filters, fallbackCurrency),
    [fallbackCurrency, filters]
  );
  const budgetPresets = useMemo(() => resolveBudgetPresets(draftFilters), [draftFilters]);

  const openFiltersSheet = (sheet: Exclude<ExploreV2SheetKind, null>) => {
    setDraftFilters(filters);
    setOpenSheet(sheet);
  };

  const applySheetFilters = () => {
    onApplyFilters(draftFilters);
    setOpenSheet(null);
  };

  const resetSheetFilters = () => {
    if (openSheet === "market") {
      setDraftFilters((current) => ({
        ...current,
        market: defaultMarket,
        budgetMin: null,
        budgetMax: null,
      }));
      return;
    }
    if (openSheet === "type") {
      setDraftFilters((current) => ({ ...current, type: "all" }));
      return;
    }
    if (openSheet === "beds") {
      setDraftFilters((current) => ({ ...current, beds: "any" }));
      return;
    }
    if (openSheet === "budget") {
      setDraftFilters((current) => ({ ...current, budgetMin: null, budgetMax: null }));
    }
  };

  return (
    <section className="mb-4 rounded-3xl border border-slate-200 bg-white/92 px-4 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Explore</h1>
          <p className="mt-1 text-xs text-slate-500" data-testid="explore-v2-header-summary">
            {subtitle}
          </p>
        </div>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex h-8 items-center rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            data-testid="explore-v2-clear-all"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div
        className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        data-testid="explore-v2-chip-row"
      >
        <button
          type="button"
          onClick={() => openFiltersSheet("market")}
          className={cn(
            glassSurface(
              "h-9 shrink-0 px-3 text-xs font-semibold transition motion-reduce:transition-none"
            ),
            filters.market !== defaultMarket ? "border-white/40 bg-slate-900/62" : "border-white/18 bg-slate-900/44"
          )}
          data-testid="explore-v2-chip-market"
        >
          {resolveMarketChipLabel(filters)}
        </button>
        <button
          type="button"
          onClick={() => openFiltersSheet("type")}
          className={cn(
            glassSurface(
              "h-9 shrink-0 px-3 text-xs font-semibold transition motion-reduce:transition-none"
            ),
            filters.type !== "all" ? "border-white/40 bg-slate-900/62" : "border-white/18 bg-slate-900/44"
          )}
          data-testid="explore-v2-chip-type"
        >
          {resolveTypeChipLabel(filters)}
        </button>
        <button
          type="button"
          onClick={() => openFiltersSheet("beds")}
          className={cn(
            glassSurface(
              "h-9 shrink-0 px-3 text-xs font-semibold transition motion-reduce:transition-none"
            ),
            filters.beds !== "any" ? "border-white/40 bg-slate-900/62" : "border-white/18 bg-slate-900/44"
          )}
          data-testid="explore-v2-chip-beds"
        >
          {resolveBedsChipLabel(filters)}
        </button>
        <button
          type="button"
          onClick={() => openFiltersSheet("budget")}
          className={cn(
            glassSurface(
              "h-9 shrink-0 px-3 text-xs font-semibold transition motion-reduce:transition-none"
            ),
            filters.budgetMin !== null || filters.budgetMax !== null
              ? "border-white/40 bg-slate-900/62"
              : "border-white/18 bg-slate-900/44"
          )}
          data-testid="explore-v2-chip-budget"
        >
          {resolveBudgetChipLabel(filters, fallbackCurrency)}
        </button>
      </div>

      <BottomSheet
        open={openSheet !== null}
        onOpenChange={(nextOpen) => setOpenSheet(nextOpen ? openSheet : null)}
        title={
          openSheet === "market"
            ? "Select market"
            : openSheet === "type"
              ? "Select listing type"
              : openSheet === "beds"
                ? "Select bedrooms"
                : "Select budget"
        }
        description="Apply filters to refine your Explore feed."
        testId="explore-v2-filter-sheet"
      >
        {openSheet === "market" ? (
          <div className="space-y-2" data-testid="explore-v2-sheet-market">
            {MARKET_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-sm",
                  draftFilters.market === option.value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                )}
                onClick={() =>
                  setDraftFilters((current) => ({
                    ...current,
                    market: option.value,
                    budgetMin: null,
                    budgetMax: null,
                  }))
                }
                data-testid={`explore-v2-market-option-${option.value}`}
              >
                <span>{option.label}</span>
                {draftFilters.market === option.value ? <span>✓</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        {openSheet === "type" ? (
          <div className="space-y-2" data-testid="explore-v2-sheet-type">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-sm",
                  draftFilters.type === option.value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                )}
                onClick={() => setDraftFilters((current) => ({ ...current, type: option.value }))}
                data-testid={`explore-v2-type-option-${option.value}`}
              >
                <span>{option.label}</span>
                {draftFilters.type === option.value ? <span>✓</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        {openSheet === "beds" ? (
          <div className="space-y-2" data-testid="explore-v2-sheet-beds">
            {BEDS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-sm",
                  draftFilters.beds === option.value
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                )}
                onClick={() => setDraftFilters((current) => ({ ...current, beds: option.value }))}
                data-testid={`explore-v2-beds-option-${option.value}`}
              >
                <span>{option.label}</span>
                {draftFilters.beds === option.value ? <span>✓</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        {openSheet === "budget" ? (
          <div className="space-y-2" data-testid="explore-v2-sheet-budget">
            {draftFilters.market === "all" ? (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Select a market first to apply a budget range.
              </p>
            ) : null}
            {budgetPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-sm",
                  isBudgetPresetSelected(draftFilters, preset)
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700"
                )}
                onClick={() =>
                  setDraftFilters((current) => ({
                    ...current,
                    budgetMin: preset.min,
                    budgetMax: preset.max,
                  }))
                }
                data-testid={`explore-v2-budget-option-${preset.id}`}
              >
                <span>{preset.label}</span>
                {isBudgetPresetSelected(draftFilters, preset) ? <span>✓</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={resetSheetFilters}
            className="inline-flex h-9 items-center rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-700"
            data-testid="explore-v2-sheet-reset"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={applySheetFilters}
            className="inline-flex h-9 items-center rounded-full bg-slate-900 px-4 text-xs font-semibold text-white"
            data-testid="explore-v2-sheet-apply"
          >
            Apply
          </button>
        </div>
      </BottomSheet>
    </section>
  );
}
