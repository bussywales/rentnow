"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { filtersToChips } from "@/lib/search-filters";
import {
  buildSearchHref,
  LAST_SEARCH_STORAGE_KEY,
  type LastSearchState,
} from "@/lib/search/last-search";

export function ContinueSearchCard() {
  const [lastSearch, setLastSearch] = useState<LastSearchState | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(LAST_SEARCH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LastSearchState;
      if (!parsed?.filters) return null;
      return parsed;
    } catch {
      return null;
    }
  });

  if (!lastSearch) return null;

  const chips = filtersToChips(lastSearch.filters);
  const href = buildSearchHref(lastSearch.filters);

  return (
    <div
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      data-testid="continue-search"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Continue where you left off
          </p>
          <p className="text-lg font-semibold text-slate-900">
            {lastSearch.query || "Your last search"}
          </p>
          {chips.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <span
                  key={`${chip.label}-${chip.value}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700"
                >
                  {chip.label}: {chip.value}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={href}>
            <Button size="sm">Continue search</Button>
          </Link>
          <button
            type="button"
            className="text-xs font-semibold text-slate-500 underline-offset-4 hover:underline"
            onClick={() => {
              if (typeof window === "undefined") return;
              window.localStorage.removeItem(LAST_SEARCH_STORAGE_KEY);
              setLastSearch(null);
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
