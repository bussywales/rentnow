"use client";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

type Props = {
  showCompactSearch: boolean;
  whereSummary: string;
  datesSummary: string;
  guestsSummary: string;
  sortValue: string;
  appliedFilterCount: number;
  hasActiveDrawerIndicator: boolean;
  onFocusExpandedControl: (field: "where" | "checkIn" | "guests") => void;
  onSortChange: (value: string) => void;
  onSubmitSearch: () => void;
  onOpenFiltersDrawer: () => void;
};

export function ShortletsMobileStickyBar({
  showCompactSearch,
  whereSummary,
  datesSummary,
  guestsSummary,
  sortValue,
  appliedFilterCount,
  hasActiveDrawerIndicator,
  onFocusExpandedControl,
  onSortChange,
  onSubmitSearch,
  onOpenFiltersDrawer,
}: Props) {
  if (!showCompactSearch) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[78px] z-30 flex translate-y-0 justify-center px-3 opacity-100 transition-all duration-200"
      data-testid="shortlets-compact-search-pill"
      data-active="true"
      aria-hidden={false}
    >
      <div className="pointer-events-auto w-full max-w-[760px] rounded-2xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
        <div
          className="scrollbar-none flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap pr-0.5"
          data-testid="shortlets-mobile-sticky-controls-row"
        >
          <button
            type="button"
            onClick={() => onFocusExpandedControl("where")}
            className="inline-flex h-8 shrink-0 items-center rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <span className="truncate">{whereSummary}</span>
          </button>
          <button
            type="button"
            onClick={() => onFocusExpandedControl("checkIn")}
            className="inline-flex h-8 shrink-0 items-center rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <span className="truncate">{datesSummary}</span>
          </button>
          <button
            type="button"
            onClick={() => onFocusExpandedControl("guests")}
            className="inline-flex h-8 shrink-0 items-center rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <span className="truncate">{guestsSummary}</span>
          </button>
          <Select
            value={sortValue}
            onChange={(event) => onSortChange(event.target.value)}
            className="h-8 w-[118px] shrink-0 text-[11px]"
            aria-label="Sort compact"
          >
            <option value="recommended">Recommended</option>
            <option value="price_asc">Price low-high</option>
            <option value="price_desc">Price high-low</option>
            <option value="rating">Rating</option>
            <option value="newest">Newest</option>
          </Select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onOpenFiltersDrawer}
            className="h-8 shrink-0 whitespace-nowrap px-3"
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
          <Button onClick={onSubmitSearch} size="sm" className="h-8 shrink-0 whitespace-nowrap px-3">
            Search
          </Button>
        </div>
      </div>
    </div>
  );
}
