"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Property } from "@/lib/types";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { cn } from "@/components/ui/cn";

const INTENT_OPTIONS = [
  { value: "all", label: "All" },
  { value: "rent", label: "Rent / Lease" },
  { value: "buy", label: "For Sale" },
] as const;

type IntentFilter = (typeof INTENT_OPTIONS)[number]["value"];

type Props = {
  listings: Property[];
  contactHref?: string;
  clientPageId?: string | null;
};

function parseNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function AgentClientPageListingsClient({
  listings,
  contactHref,
  clientPageId,
}: Props) {
  const [intent, setIntent] = useState<IntentFilter>("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");

  const filtered = useMemo(() => {
    const min = parseNumber(minPrice);
    const max = parseNumber(maxPrice);
    const minBeds = parseNumber(bedrooms);

    return listings.filter((listing) => {
      if (intent !== "all" && (listing.listing_intent ?? "rent") !== intent) return false;
      if (typeof min === "number" && (listing.price ?? 0) < min) return false;
      if (typeof max === "number" && (listing.price ?? 0) > max) return false;
      if (typeof minBeds === "number" && (listing.bedrooms ?? 0) < minBeds) return false;
      return true;
    });
  }, [intent, minPrice, maxPrice, bedrooms, listings]);

  const countLabel = `${filtered.length} ${filtered.length === 1 ? "listing" : "listings"}`;

  if (filtered.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
        <p className="text-base font-semibold text-slate-900">No matches right now</p>
        <p className="mt-2 text-sm text-slate-600">
          Nothing matches this shortlist at the moment. The agent can update the criteria or add
          new homes as they come in.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {contactHref && (
            <Link
              href={contactHref}
              className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              Message agent
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4" data-testid="client-page-listings">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {INTENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setIntent(option.value)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-semibold transition",
                intent === option.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              )}
              aria-pressed={intent === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          {countLabel}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Min price
          <input
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            placeholder="0"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Max price
          <input
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            placeholder="Any"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Bedrooms (min)
          <input
            value={bedrooms}
            onChange={(event) => setBedrooms(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            placeholder="Any"
          />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((listing) => {
          const href = clientPageId
            ? `/properties/${listing.id}?src=client_page&cp=${clientPageId}`
            : undefined;
          return <PropertyCard key={listing.id} property={listing} href={href} />;
        })}
      </div>
    </section>
  );
}
