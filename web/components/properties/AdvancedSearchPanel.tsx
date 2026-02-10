"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ListingType, ParsedSearchFilters } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type Props = {
  initialFilters: ParsedSearchFilters;
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

export function AdvancedSearchPanel({ initialFilters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(
    (initialFilters.bedroomsMode ?? "exact") !== "exact" ||
      Boolean(initialFilters.includeSimilarOptions) ||
      initialFilters.minPrice !== null ||
      initialFilters.maxPrice !== null ||
      Boolean(initialFilters.propertyType) ||
      initialFilters.furnished !== null
  );
  const [bedrooms, setBedrooms] = useState(
    initialFilters.bedrooms !== null ? String(initialFilters.bedrooms) : ""
  );
  const [bedroomsMode, setBedroomsMode] = useState<"exact" | "minimum">(
    initialFilters.bedroomsMode === "minimum" ? "minimum" : "exact"
  );
  const [includeSimilarOptions, setIncludeSimilarOptions] = useState(
    Boolean(initialFilters.includeSimilarOptions)
  );
  const [minPrice, setMinPrice] = useState(
    initialFilters.minPrice !== null ? String(initialFilters.minPrice) : ""
  );
  const [maxPrice, setMaxPrice] = useState(
    initialFilters.maxPrice !== null ? String(initialFilters.maxPrice) : ""
  );
  const [propertyType, setPropertyType] = useState(initialFilters.propertyType ?? "");
  const [furnished, setFurnished] = useState<"any" | "true" | "false">(
    initialFilters.furnished === null
      ? "any"
      : initialFilters.furnished
      ? "true"
      : "false"
  );

  const updateQuery = (next: URLSearchParams) => {
    next.set("page", "1");
    next.delete("savedSearchId");
    next.delete("source");
    const queryString = next.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const apply = () => {
    const next = new URLSearchParams(searchParams.toString());
    const parsedBedrooms = toNumberOrNull(bedrooms);
    const parsedMinPrice = toNumberOrNull(minPrice);
    const parsedMaxPrice = toNumberOrNull(maxPrice);

    if (parsedBedrooms === null) {
      next.delete("bedrooms");
      next.delete("bedroomsMode");
      next.delete("includeSimilarOptions");
    } else {
      next.set("bedrooms", String(Math.trunc(parsedBedrooms)));
      if (bedroomsMode === "minimum") next.set("bedroomsMode", "minimum");
      else next.delete("bedroomsMode");
      if (includeSimilarOptions) next.set("includeSimilarOptions", "true");
      else next.delete("includeSimilarOptions");
    }

    if (parsedMinPrice === null) next.delete("minPrice");
    else next.set("minPrice", String(Math.trunc(parsedMinPrice)));

    if (parsedMaxPrice === null) next.delete("maxPrice");
    else next.set("maxPrice", String(Math.trunc(parsedMaxPrice)));

    if (propertyType) next.set("propertyType", propertyType);
    else next.delete("propertyType");

    if (furnished === "any") next.delete("furnished");
    else next.set("furnished", furnished);

    updateQuery(next);
  };

  const reset = () => {
    const next = new URLSearchParams(searchParams.toString());
    ["bedrooms", "bedroomsMode", "includeSimilarOptions", "minPrice", "maxPrice", "propertyType", "furnished"].forEach(
      (key) => next.delete(key)
    );
    setBedrooms("");
    setBedroomsMode("exact");
    setIncludeSimilarOptions(false);
    setMinPrice("");
    setMaxPrice("");
    setPropertyType("");
    setFurnished("any");
    updateQuery(next);
  };

  return (
    <details
      className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm"
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
        More options
      </summary>
      <p className="mt-2 text-sm text-slate-500">
        Default search uses exact bedroom matching. Expand these filters when you want broader matching.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm text-slate-700">
          <span>Bedrooms</span>
          <Input
            type="number"
            min={0}
            step={1}
            value={bedrooms}
            onChange={(event) => setBedrooms(event.target.value)}
            placeholder="e.g. 2"
            data-testid="advanced-bedrooms"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Beds mode</span>
          <Select
            value={bedroomsMode}
            onChange={(event) =>
              setBedroomsMode(event.target.value === "minimum" ? "minimum" : "exact")
            }
            data-testid="advanced-bedrooms-mode"
          >
            <option value="exact">Exact</option>
            <option value="minimum">Minimum</option>
          </Select>
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Price min</span>
          <Input
            type="number"
            min={0}
            step={1}
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            placeholder="0"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Price max</span>
          <Input
            type="number"
            min={0}
            step={1}
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            placeholder="Any"
          />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span>Property type</span>
          <Select
            value={propertyType}
            onChange={(event) => setPropertyType(event.target.value)}
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
            value={furnished}
            onChange={(event) => {
              const value = event.target.value;
              setFurnished(value === "true" || value === "false" ? value : "any");
            }}
            data-testid="advanced-furnished"
          >
            <option value="any">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        </label>
      </div>

      <label className="mt-3 inline-flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={includeSimilarOptions}
          onChange={(event) => setIncludeSimilarOptions(event.target.checked)}
          data-testid="advanced-include-similar"
        />
        <span>
          <span className="font-medium text-slate-900">Include similar options in main results</span>
          <span className="block text-xs text-slate-600">
            Keep this off to show exact matches first and view other options separately.
          </span>
        </span>
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={apply}>
          Apply
        </Button>
        <Button type="button" variant="secondary" onClick={reset}>
          Reset
        </Button>
      </div>
    </details>
  );
}
