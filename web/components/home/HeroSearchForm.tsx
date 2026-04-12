"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import { cn } from "@/components/ui/cn";
import { formatCurrencySymbol } from "@/lib/market/market";
import {
  resolveIntentForMarket,
  writeStoredIntentForMarket,
} from "@/lib/home/mobile-quicksearch-intent";
import {
  buildHeroSearchHref,
  getHeroSearchPropertyTypeOptions,
  type HeroSearchMode,
} from "@/lib/home/hero-search";

const MODE_OPTIONS: Array<{
  value: HeroSearchMode;
  label: string;
  title: string;
  detail: string;
  cta: string;
}> = [
  {
    value: "rent",
    label: "Rent",
    title: "Long-term homes",
    detail: "Search verified rental homes with the right budget, beds, and listing type upfront.",
    cta: "Search rentals",
  },
  {
    value: "buy",
    label: "Buy",
    title: "For-sale homes",
    detail: "Go straight to homes for sale without starting from a rentals-only flow.",
    cta: "Search homes for sale",
  },
  {
    value: "shortlet",
    label: "Shortlets",
    title: "Bookable stays",
    detail: "Open the dedicated shortlet flow with destination, guests, and stay-aware results.",
    cta: "Search shortlets",
  },
];

function sanitizeNumericField(value: string): string {
  return value.replace(/[^\d]/g, "");
}

export function HeroSearchForm() {
  const router = useRouter();
  const { market } = useMarketPreference();
  const defaultMode = resolveIntentForMarket(market.country);
  const [mode, setMode] = useState<HeroSearchMode>(defaultMode);
  const [hasExplicitMode, setHasExplicitMode] = useState(false);
  const [location, setLocation] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const activeMode = hasExplicitMode ? mode : defaultMode;
  const propertyTypeOptions = useMemo(
    () => getHeroSearchPropertyTypeOptions(activeMode),
    [activeMode]
  );
  const selectedPropertyType = propertyTypeOptions.some((option) => option.value === propertyType)
    ? propertyType
    : "";

  const modeMeta = MODE_OPTIONS.find((option) => option.value === activeMode) ?? MODE_OPTIONS[0];
  const currencySymbol = formatCurrencySymbol(market.currency);
  const bedroomsLabel = activeMode === "shortlet" ? "Guests" : "Bedrooms";
  const propertyTypeLabel = activeMode === "shortlet" ? "Stay type" : "Property type";
  const minPricePlaceholder =
    activeMode === "shortlet" ? `Nightly min (${currencySymbol})` : `Min budget (${currencySymbol})`;
  const maxPricePlaceholder =
    activeMode === "shortlet" ? `Nightly max (${currencySymbol})` : `Max budget (${currencySymbol})`;

  const handleModeChange = (nextMode: HeroSearchMode) => {
    setMode(nextMode);
    setHasExplicitMode(true);
    setPropertyType("");
    writeStoredIntentForMarket(market.country, nextMode);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    writeStoredIntentForMarket(market.country, activeMode);
    const href = buildHeroSearchHref(activeMode, {
      location,
      minPrice,
      maxPrice,
      bedrooms,
      propertyType: selectedPropertyType,
      marketCountry: market.country,
      source: "home_hero_v2",
    });
    router.push(href);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit}
      data-testid="desktop-home-hero-search-form"
    >
      <div className="space-y-2.5">
        <div className="inline-flex rounded-full border border-slate-200 bg-slate-100/90 p-1">
          {MODE_OPTIONS.map((option) => {
            const active = option.value === activeMode;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleModeChange(option.value)}
                data-testid={`desktop-home-hero-search-mode-${option.value}`}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
                  active
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
                aria-pressed={active}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[1.7rem] font-semibold tracking-[-0.02em] text-slate-950">
              {modeMeta.title}
            </h3>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">
              {activeMode === "shortlet" ? "Dedicated flow" : "Market-aware"}
            </span>
          </div>
          <p className="max-w-lg text-sm leading-6 text-slate-600">{modeMeta.detail}</p>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200/90 bg-slate-50/65 p-3.5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="grid gap-3">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="desktop-hero-location">
              Location
            </label>
            <Input
              id="desktop-hero-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder={
                activeMode === "shortlet" ? "City, area, or landmark" : "City or neighbourhood"
              }
              className="h-14 rounded-2xl border-slate-200 bg-white text-base shadow-none"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="desktop-hero-min-price">
                Budget
              </label>
              <Input
                id="desktop-hero-min-price"
                inputMode="numeric"
                value={minPrice}
                onChange={(event) => setMinPrice(sanitizeNumericField(event.target.value))}
                placeholder={minPricePlaceholder}
                className="h-12 rounded-2xl border-slate-200 bg-white shadow-none"
              />
            </div>

            <div className="space-y-2">
              <label className="sr-only" htmlFor="desktop-hero-max-price">
                Maximum budget
              </label>
              <div className="h-4" aria-hidden="true" />
              <Input
                id="desktop-hero-max-price"
                inputMode="numeric"
                value={maxPrice}
                onChange={(event) => setMaxPrice(sanitizeNumericField(event.target.value))}
                placeholder={maxPricePlaceholder}
                className="h-12 rounded-2xl border-slate-200 bg-white shadow-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="desktop-hero-bedrooms">
                {bedroomsLabel}
              </label>
              <Input
                id="desktop-hero-bedrooms"
                inputMode="numeric"
                value={bedrooms}
                onChange={(event) => setBedrooms(sanitizeNumericField(event.target.value))}
                placeholder={activeMode === "shortlet" ? "Guests" : "Bedrooms"}
                className="h-12 rounded-2xl border-slate-200 bg-white shadow-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="desktop-hero-property-type">
                {propertyTypeLabel}
              </label>
              <Select
                id="desktop-hero-property-type"
                value={selectedPropertyType}
                onChange={(event) => setPropertyType(event.target.value)}
                className="h-12 rounded-2xl border-slate-200 bg-white px-4 shadow-none"
              >
                <option value="">Any {propertyTypeLabel.toLowerCase()}</option>
                {propertyTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-sm leading-6 text-slate-500">
          Opens the right discovery flow for {activeMode === "shortlet" ? "stays" : "homes"} in your selected market.
        </p>
        <Button type="submit" size="lg" className="rounded-2xl px-6 sm:min-w-[220px]">
          {modeMeta.cta}
        </Button>
      </div>
    </form>
  );
}
