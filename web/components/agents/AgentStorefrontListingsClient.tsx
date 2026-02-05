"use client";

import { useMemo, useState } from "react";
import type { Property } from "@/lib/types";
import { cn } from "@/components/ui/cn";
import { PropertyCard } from "@/components/properties/PropertyCard";

const FILTERS = [
  { key: "all", label: "All listings" },
  { key: "rent", label: "Rent / Lease" },
  { key: "buy", label: "For Sale" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

type Props = {
  listings: Property[];
};

export default function AgentStorefrontListingsClient({ listings }: Props) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return listings;
    return listings.filter((item) => (item.listing_intent ?? "rent") === filter);
  }, [filter, listings]);

  return (
    <section className="space-y-4" data-testid="agent-storefront-listings">
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

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
          No listings match this filter yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((listing) => (
            <PropertyCard key={listing.id} property={listing} />
          ))}
        </div>
      )}
    </section>
  );
}
