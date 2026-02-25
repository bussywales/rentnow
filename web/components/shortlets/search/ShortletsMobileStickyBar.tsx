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
      className="pointer-events-none fixed inset-x-0 top-20 z-30 flex translate-y-0 justify-center px-4 opacity-100 transition-all duration-200"
      data-testid="shortlets-compact-search-pill"
      data-active="true"
      aria-hidden={false}
    >
      <div className="pointer-events-auto w-full max-w-[1200px] rounded-full border border-slate-200 bg-white/95 px-2 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="flex min-w-0 flex-wrap items-center gap-2 md:flex-nowrap">
          <button
            type="button"
            onClick={() => onFocusExpandedControl("where")}
            className="inline-flex h-9 min-w-0 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <span className="truncate">{whereSummary}</span>
          </button>
          <button
            type="button"
            onClick={() => onFocusExpandedControl("checkIn")}
            className="inline-flex h-9 min-w-0 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <span className="truncate">{datesSummary}</span>
          </button>
          <button
            type="button"
            onClick={() => onFocusExpandedControl("guests")}
            className="inline-flex h-9 min-w-0 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <span className="truncate">{guestsSummary}</span>
          </button>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 md:ml-auto md:w-auto md:flex-nowrap">
            <Select
              value={sortValue}
              onChange={(event) => onSortChange(event.target.value)}
              className="h-9 min-w-0 flex-1 text-xs md:w-[126px] md:flex-none"
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
              onClick={onOpenFiltersDrawer}
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
  );
}
