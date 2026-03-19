"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ListingType, ParsedSearchFilters } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FilterDrawerShell } from "@/components/filters/FilterDrawerShell";
import {
  createApplyAndCloseAction,
  createClearApplyAndCloseAction,
  createResetDraftAction,
} from "@/components/filters/filter-actions";
import { parseFiltersFromSearchParams } from "@/lib/search-filters";

type Props = {
  initialFilters: ParsedSearchFilters;
};

type AdvancedFiltersDraft = {
  bedrooms: string;
  bedroomsMode: "exact" | "minimum";
  includeSimilarOptions: boolean;
  minPrice: string;
  maxPrice: string;
  propertyType: string;
  furnished: "any" | "true" | "false";
};

const PROPERTY_TYPES: Array<{ value: ListingType; label: string }> = [
  { value: "apartment", label: "Apartment" },
  { value: "condo", label: "Condo" },
  { value: "house", label: "House" },
  { value: "duplex", label: "Duplex" },
  { value: "bungalow", label: "Bungalow" },
  { value: "studio", label: "Studio" },
  { value: "room", label: "Room" },
  { value: "student", label: "Student" },
  { value: "hostel", label: "Hostel" },
  { value: "shop", label: "Shop" },
  { value: "office", label: "Office" },
  { value: "land", label: "Land" },
];

function toNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, num);
}

export function normalizePriceDraftValue(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function createDefaultDraft(): AdvancedFiltersDraft {
  return {
    bedrooms: "",
    bedroomsMode: "exact",
    includeSimilarOptions: false,
    minPrice: "",
    maxPrice: "",
    propertyType: "",
    furnished: "any",
  };
}

function createDraftFromFilters(filters: ParsedSearchFilters): AdvancedFiltersDraft {
  return {
    bedrooms: filters.bedrooms !== null ? String(filters.bedrooms) : "",
    bedroomsMode: filters.bedroomsMode === "minimum" ? "minimum" : "exact",
    includeSimilarOptions: Boolean(filters.includeSimilarOptions),
    minPrice: filters.minPrice !== null ? String(filters.minPrice) : "",
    maxPrice: filters.maxPrice !== null ? String(filters.maxPrice) : "",
    propertyType: filters.propertyType ?? "",
    furnished: filters.furnished === null ? "any" : filters.furnished ? "true" : "false",
  };
}

function countActiveAdvancedFilters(draft: AdvancedFiltersDraft): number {
  let count = 0;
  if (draft.bedrooms.trim()) count += 1;
  if (draft.bedroomsMode === "minimum") count += 1;
  if (draft.includeSimilarOptions) count += 1;
  if (draft.minPrice.trim()) count += 1;
  if (draft.maxPrice.trim()) count += 1;
  if (draft.propertyType) count += 1;
  if (draft.furnished !== "any") count += 1;
  return count;
}

export function AdvancedSearchPanel({ initialFilters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialDraft = useMemo(() => createDraftFromFilters(initialFilters), [initialFilters]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AdvancedFiltersDraft>(initialDraft);
  const drawerId = "properties-filters-drawer-panel";
  const closeDrawer = useCallback(() => {
    setOpen(false);
  }, []);

  const updateQuery = useCallback(
    (next: URLSearchParams) => {
      next.set("page", "1");
      next.delete("savedSearchId");
      next.delete("source");
      const queryString = next.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [pathname, router]
  );

  const readAppliedDraft = useCallback((): AdvancedFiltersDraft => {
    const parsed = parseFiltersFromSearchParams(new URLSearchParams(searchParams.toString()));
    return createDraftFromFilters(parsed);
  }, [searchParams]);

  const applyDraft = useCallback(
    (nextDraft: AdvancedFiltersDraft) => {
      const next = new URLSearchParams(searchParams.toString());
      const parsedBedrooms = toNumberOrNull(nextDraft.bedrooms);
      const parsedMinPrice = toNumberOrNull(nextDraft.minPrice);
      const parsedMaxPrice = toNumberOrNull(nextDraft.maxPrice);

      if (parsedBedrooms === null) {
        next.delete("bedrooms");
        next.delete("bedroomsMode");
        next.delete("includeSimilarOptions");
      } else {
        next.set("bedrooms", String(Math.trunc(parsedBedrooms)));
        if (nextDraft.bedroomsMode === "minimum") next.set("bedroomsMode", "minimum");
        else next.delete("bedroomsMode");
        if (nextDraft.includeSimilarOptions) next.set("includeSimilarOptions", "true");
        else next.delete("includeSimilarOptions");
      }

      if (parsedMinPrice === null) next.delete("minPrice");
      else next.set("minPrice", String(Math.trunc(parsedMinPrice)));

      if (parsedMaxPrice === null) next.delete("maxPrice");
      else next.set("maxPrice", String(Math.trunc(parsedMaxPrice)));

      if (nextDraft.propertyType) next.set("propertyType", nextDraft.propertyType);
      else next.delete("propertyType");

      if (nextDraft.furnished === "any") next.delete("furnished");
      else next.set("furnished", nextDraft.furnished);

      updateQuery(next);
    },
    [searchParams, updateQuery]
  );

  const openDrawer = useCallback(() => {
    setDraft(readAppliedDraft());
    setOpen(true);
  }, [readAppliedDraft]);

  const appliedDraft = useMemo(() => readAppliedDraft(), [readAppliedDraft]);
  const activeCount = useMemo(() => countActiveAdvancedFilters(appliedDraft), [appliedDraft]);

  const onReset = useMemo(
    () => createResetDraftAction(readAppliedDraft, setDraft),
    [readAppliedDraft]
  );
  const onApply = useMemo(
    () => createApplyAndCloseAction(() => applyDraft(draft), closeDrawer),
    [applyDraft, closeDrawer, draft]
  );
  const onClear = useMemo(
    () =>
      createClearApplyAndCloseAction(createDefaultDraft, setDraft, applyDraft, closeDrawer),
    [applyDraft, closeDrawer]
  );

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">More options</p>
          <p className="text-xs text-slate-500">
            Refine homes with the same filter workflow used in shortlets.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={openDrawer}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={drawerId}
          data-testid="properties-filters-button"
        >
          <span className="inline-flex items-center gap-1.5">
            <span>{activeCount > 0 ? `Filters (${activeCount})` : "Filters"}</span>
            {activeCount > 0 ? (
              <span
                className="h-2 w-2 rounded-full bg-sky-500"
                data-testid="properties-filters-active-indicator"
              />
            ) : null}
          </span>
        </Button>
      </div>

      <FilterDrawerShell
        open={open}
        onClose={closeDrawer}
        title="Filters"
        subtitle="Apply the same workflow as shortlets: adjust, apply, reset, or clear."
        onApply={onApply}
        onReset={onReset}
        onClear={onClear}
        drawerTestId="properties-filters-drawer"
        overlayTestId="properties-filters-overlay"
        ariaLabel="Property filters"
        dialogId={drawerId}
      >
        <div className="space-y-5">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">Bedrooms</h2>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Bedrooms</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={draft.bedrooms}
                onChange={(event) => setDraft((current) => ({ ...current, bedrooms: event.target.value }))}
                placeholder="e.g. 2"
                data-testid="advanced-bedrooms"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Beds mode</span>
              <Select
                value={draft.bedroomsMode}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    bedroomsMode: event.target.value === "minimum" ? "minimum" : "exact",
                  }))
                }
                data-testid="advanced-bedrooms-mode"
              >
                <option value="exact">Exact</option>
                <option value="minimum">Minimum</option>
              </Select>
            </label>
            <label className="inline-flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={draft.includeSimilarOptions}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, includeSimilarOptions: event.target.checked }))
                }
                data-testid="advanced-include-similar"
              />
              <span>
                <span className="font-medium text-slate-900">Include similar options in main results</span>
                <span className="block text-xs text-slate-600">
                  Keep this off to show exact matches first and view other options separately.
                </span>
              </span>
            </label>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">Price</h2>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Price min</span>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={draft.minPrice}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    minPrice: normalizePriceDraftValue(event.target.value),
                  }))
                }
                placeholder="0"
                data-testid="advanced-min-price"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Price max</span>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={draft.maxPrice}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    maxPrice: normalizePriceDraftValue(event.target.value),
                  }))
                }
                placeholder="Any"
                data-testid="advanced-max-price"
              />
            </label>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">Property details</h2>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Property type</span>
              <Select
                value={draft.propertyType}
                onChange={(event) => setDraft((current) => ({ ...current, propertyType: event.target.value }))}
                data-testid="advanced-property-type"
              >
                <option value="">Any</option>
                {PROPERTY_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span>Furnished</span>
              <Select
                value={draft.furnished}
                onChange={(event) => {
                  const value = event.target.value;
                  setDraft((current) => ({
                    ...current,
                    furnished: value === "true" || value === "false" ? value : "any",
                  }));
                }}
                data-testid="advanced-furnished"
              >
                <option value="any">Any</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </Select>
            </label>
          </section>
        </div>
      </FilterDrawerShell>
    </>
  );
}
