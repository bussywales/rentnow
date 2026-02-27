"use client";

import Link from "next/link";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import { formatCadence, formatLocationLabel, formatPriceValue } from "@/lib/property-discovery";
import { resolveShortletNightlyPriceMinor } from "@/lib/shortlet/discovery";
import type { Property } from "@/lib/types";
import {
  resolveExploreDetailsHref,
  resolveExplorePrimaryAction,
} from "@/lib/explore/explore-presentation";

type ExploreDetailsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property;
};

function factsForProperty(property: Property): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = [];
  if (Number.isFinite(property.bedrooms)) facts.push({ label: "Beds", value: String(property.bedrooms) });
  if (Number.isFinite(property.bathrooms)) facts.push({ label: "Baths", value: String(property.bathrooms) });
  if (Number.isFinite(property.max_guests)) facts.push({ label: "Guests", value: String(property.max_guests) });
  return facts;
}

export function ExploreDetailsSheet({ open, onOpenChange, property }: ExploreDetailsSheetProps) {
  const { market } = useMarketPreference();
  const location = formatLocationLabel(property.city, property.neighbourhood);
  const detailsHref = resolveExploreDetailsHref(property);
  const primaryAction = resolveExplorePrimaryAction(property);
  const shortletNightlyMinor = resolveShortletNightlyPriceMinor(property);
  const displayPrice =
    typeof shortletNightlyMinor === "number" && Number.isFinite(shortletNightlyMinor) && shortletNightlyMinor > 0
      ? shortletNightlyMinor / 100
      : property.price;
  const price = formatPriceValue(property.currency, displayPrice, {
    marketCurrency: market.currency,
  });
  const cadence = formatCadence(property.rental_type, property.rent_period);
  const facts = factsForProperty(property);
  const topAmenities = (property.amenities ?? []).slice(0, 5);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={property.title}
      description={location}
      testId="explore-details-sheet"
      sheetId={`explore-details-sheet-${property.id}`}
    >
      <div className="space-y-4" data-testid="explore-details-content">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-slate-900">{price}</p>
          {cadence ? <p className="text-xs text-slate-500">per {cadence}</p> : null}
        </div>

        {facts.length ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            {facts.map((fact) => (
              <div key={fact.label} className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{fact.label}</p>
                <p className="text-sm font-semibold text-slate-900">{fact.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {topAmenities.length ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Top amenities</p>
            <div className="flex flex-wrap gap-1.5">
              {topAmenities.map((amenity) => (
                <span
                  key={amenity}
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700"
                >
                  {amenity}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <p className="line-clamp-4 text-sm text-slate-600">
          {property.description?.trim() || "Explore this listing for photos, details, and booking options."}
        </p>

        <div className="sticky bottom-0 z-10 space-y-2 bg-white pb-1 pt-1">
          <Link href={primaryAction.href} className="block" onClick={() => onOpenChange(false)}>
            <Button className="w-full" data-testid="explore-primary-cta">
              {primaryAction.label}
            </Button>
          </Link>
          <Link
            href={detailsHref}
            className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            data-testid="explore-view-full-details"
            onClick={() => onOpenChange(false)}
          >
            View full details
          </Link>
        </div>
      </div>
    </BottomSheet>
  );
}
