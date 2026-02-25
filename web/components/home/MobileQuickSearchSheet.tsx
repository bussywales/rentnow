"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getRecentBrowseIntent } from "@/lib/market/browse-intent";
import {
  buildPropertiesCategoryParams,
  resolvePropertiesBrowseCategory,
  type PropertiesBrowseCategory,
} from "@/lib/properties/browse-categories";

type QuickSearchCategory = Exclude<PropertiesBrowseCategory, "shortlet">;

type QuickSearchIntentOption = {
  key: QuickSearchCategory;
  label: string;
};

const QUICK_SEARCH_INTENT_OPTIONS: QuickSearchIntentOption[] = [
  { key: "rent", label: "To rent" },
  { key: "buy", label: "For sale" },
  { key: "off_plan", label: "Off-plan" },
  { key: "all", label: "All homes" },
];

function resolveQuickSearchCategory(lastSearchParams: string | null | undefined): QuickSearchCategory {
  if (!lastSearchParams) return "rent";
  const params = new URLSearchParams(lastSearchParams);
  const resolved = resolvePropertiesBrowseCategory({
    categoryParam: params.get("category"),
    intentParam: params.get("intent"),
    stayParam: params.get("stay"),
    listingIntentParam: params.get("listingIntent"),
  });
  if (resolved === "shortlet") return "rent";
  return resolved;
}

function resolveQuickSearchLocation(lastSearchParams: string | null | undefined): string {
  if (!lastSearchParams) return "";
  const params = new URLSearchParams(lastSearchParams);
  return params.get("city")?.trim() ?? "";
}

export function buildMobileQuickSearchHref(input: {
  category: QuickSearchCategory;
  city?: string | null;
}): string {
  const params = buildPropertiesCategoryParams(new URLSearchParams(), input.category);
  const city = input.city?.trim();
  if (city) {
    params.set("city", city);
  } else {
    params.delete("city");
  }
  const query = params.toString();
  return query ? `/properties?${query}` : "/properties";
}

type MobileQuickSearchSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MobileQuickSearchSheet({ open, onOpenChange }: MobileQuickSearchSheetProps) {
  const [category, setCategory] = useState<QuickSearchCategory>("rent");
  const [city, setCity] = useState("");

  useEffect(() => {
    if (!open) return;
    const recentIntent = getRecentBrowseIntent(14);
    const lastSearchParams = recentIntent?.lastSearchParams ?? null;
    setCategory(resolveQuickSearchCategory(lastSearchParams));
    setCity(resolveQuickSearchLocation(lastSearchParams));
  }, [open]);

  const searchHref = useMemo(
    () =>
      buildMobileQuickSearchHref({
        category,
        city,
      }),
    [category, city]
  );

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Start your search"
      description="Pick a category, add a location, then open filtered results."
    >
      <div className="space-y-4" data-testid="mobile-quicksearch-sheet">
        <div className="flex flex-wrap gap-2" data-testid="mobile-quicksearch-intent-chips">
          {QUICK_SEARCH_INTENT_OPTIONS.map((option) => {
            const active = category === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setCategory(option.key)}
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

        <div className="space-y-1.5">
          <label htmlFor="mobile-quicksearch-location" className="text-xs font-semibold text-slate-700">
            Location
          </label>
          <Input
            id="mobile-quicksearch-location"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="City or area"
            data-testid="mobile-quicksearch-location-input"
            className="rounded-xl border-slate-200"
          />
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Button
            type="button"
            onClick={() => {
              onOpenChange(false);
              if (typeof window !== "undefined") {
                window.location.assign(searchHref);
              }
            }}
            data-testid="mobile-quicksearch-search"
          >
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
      </div>
    </BottomSheet>
  );
}
