"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Property } from "@/lib/types";
import { cn } from "@/components/ui/cn";
import { PropertyCard } from "@/components/properties/PropertyCard";

const FILTERS = [
  { key: "all", label: "All listings" },
  { key: "rent", label: "Rent / Lease" },
  { key: "buy", label: "For Sale" },
] as const;

const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "price_low", label: "Price: Low to High" },
  { key: "price_high", label: "Price: High to Low" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];
type SortKey = (typeof SORTS)[number]["key"];

type Props = {
  listings: Property[];
  contactHref?: string;
  isOwner?: boolean;
};

function getListingTimestamp(listing: Property) {
  const value = listing.updated_at || listing.created_at;
  if (!value) return 0;
  return new Date(value).getTime();
}

export default function AgentStorefrontListingsClient({ listings, contactHref, isOwner }: Props) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  const filtered = useMemo(() => {
    if (filter === "all") return listings;
    return listings.filter((item) => (item.listing_intent ?? "rent") === filter);
  }, [filter, listings]);

  const sorted = useMemo(() => {
    const next = [...filtered];
    if (sort === "newest") {
      next.sort((a, b) => getListingTimestamp(b) - getListingTimestamp(a));
      return next;
    }
    if (sort === "price_low") {
      next.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      return next;
    }
    next.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    return next;
  }, [filtered, sort]);

  const resultsLabel = `${sorted.length} ${sorted.length === 1 ? "listing" : "listings"}`;

  return (
    <section className="space-y-4" data-testid="agent-storefront-listings">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-semibold transition",
                filter === item.key
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              )}
              aria-pressed={filter === item.key}
              onClick={() => setFilter(item.key)}
              data-testid={`agent-storefront-filter-${item.key}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span data-testid="agent-storefront-count">{resultsLabel}</span>
          <label className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Sort
            </span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-sm"
              data-testid="agent-storefront-sort"
            >
              {SORTS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-base font-semibold text-slate-900">
            No live listings right now
          </p>
          <p className="mt-2 text-sm text-slate-600">
            This agent doesn’t have any live listings at the moment — but you can still reach out
            with what you’re looking for.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {contactHref && (
              <Link
                href={contactHref}
                className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              >
                Contact agent
              </Link>
            )}
            {isOwner && (
              <Link
                href="/dashboard/properties/new"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
              >
                Add a listing
              </Link>
            )}
          </div>
          {isOwner && (
            <p className="mt-4 text-sm text-slate-500">
              Ready to publish? Add your first listing to appear here.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((listing) => (
            <PropertyCard key={listing.id} property={listing} />
          ))}
        </div>
      )}
    </section>
  );
}
