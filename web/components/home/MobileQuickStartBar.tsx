"use client";

import Link from "next/link";
import { useState } from "react";
import { MobileQuickSearchSheet } from "@/components/home/MobileQuickSearchSheet";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";

const QUICK_START_LINKS = [
  {
    key: "shortlets",
    href: "/shortlets",
    label: "Shortlets",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
        <path
          d="M4 12h16M4 6h16M4 18h10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    key: "rent",
    href: "/properties?intent=rent",
    label: "To rent",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
        <path
          d="M3 11.5 12 4l9 7.5v8.5h-6v-5h-6v5H3z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: "sale",
    href: "/properties?intent=sale",
    label: "For sale",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
        <path
          d="M5 12h14M12 5l7 7-7 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: "offplan",
    href: "/properties?intent=off_plan",
    label: "Off-plan",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
        <path
          d="M4 18h16M6 14l4-4 3 3 5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: "all",
    href: "/properties",
    label: "All homes",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
        <path
          d="M4 6h16v12H4zM9 6v12M15 6v12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: "explore",
    href: "/explore",
    label: "Explore",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
        <path
          d="m4 20 5.5-13.5L23 1 17.5 14.5zM9.5 6.5l8 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
] as const;

type MobileQuickStartBarProps = {
  showExploreChip?: boolean;
};

export function MobileQuickStartBar({ showExploreChip = true }: MobileQuickStartBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { market } = useMarketPreference();
  const quickSearchSheetId = "mobile-quicksearch-sheet-dialog";
  const quickStartLinks = showExploreChip
    ? QUICK_START_LINKS
    : QUICK_START_LINKS.filter((entry) => entry.key !== "explore");

  return (
    <section
      className="sticky top-[72px] z-20 md:hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
      data-testid="mobile-quickstart"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Quick start</p>
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={searchOpen}
        aria-controls={quickSearchSheetId}
        className="mt-2 block rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700"
        data-testid="mobile-quickstart-search-trigger"
      >
        Search for homes or stays
      </button>
      <div className="scrollbar-none -mx-1 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
        {quickStartLinks.map((entry) => (
          <Link
            key={entry.key}
            href={entry.href}
            className="inline-flex snap-start shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            data-testid={`mobile-quickstart-chip-${entry.key}`}
          >
            <span className="text-slate-500">{entry.icon}</span>
            {entry.label}
          </Link>
        ))}
      </div>
      <MobileQuickSearchSheet
        key={market.country}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        sheetId={quickSearchSheetId}
      />
    </section>
  );
}
