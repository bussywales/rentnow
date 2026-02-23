"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { ListingImagePlaceholder } from "@/components/ui/ListingImagePlaceholder";
import { resolveImageLoadingProfile, shouldPriorityImage } from "@/lib/images/loading-profile";
import { selectHostFeaturedStripListings } from "@/lib/host/featured-strip";
import { getPrimaryImageUrl } from "@/lib/properties/images";
import { mapStatusLabel, normalizePropertyStatus } from "@/lib/properties/status";
import type { DashboardListing } from "@/lib/properties/host-dashboard";

type Props = {
  listings: DashboardListing[];
};

function statusChipClass(status: string | null) {
  switch (normalizePropertyStatus(status)) {
    case "live":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "rejected":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "expired":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "paused":
    case "paused_owner":
    case "paused_occupied":
      return "border-slate-300 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function listingLocationText(listing: DashboardListing) {
  return listing.location_label || listing.city || listing.admin_area_1 || "Location not set";
}

function formatListingPrice(listing: DashboardListing): string {
  const amount = Number.isFinite(listing.price) ? Number(listing.price) : 0;
  if (!amount || amount <= 0) return "Price on request";

  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: listing.currency || "NGN",
    maximumFractionDigits: 0,
  });
  return formatter.format(amount);
}

export function HostFeaturedStrip({ listings }: Props) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [loadedById, setLoadedById] = useState<Record<string, boolean>>({});
  const featuredListings = useMemo(
    () => selectHostFeaturedStripListings(listings),
    [listings]
  );

  const scrollRail = (direction: "prev" | "next") => {
    const rail = railRef.current;
    if (!rail) return;
    const firstCard = rail.firstElementChild as HTMLElement | null;
    const cardWidth = firstCard?.clientWidth || 280;
    const distance = direction === "next" ? cardWidth + 12 : -(cardWidth + 12);
    rail.scrollBy({ left: distance, behavior: "smooth" });
  };

  if (featuredListings.length === 0) return null;

  return (
    <section
      className="space-y-2 overflow-x-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
      data-testid="host-featured-strip"
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Featured
          </p>
          <h2 className="text-base font-semibold text-slate-900">Top listing spotlight</h2>
        </div>
      </div>

      <div className="group relative">
        <button
          type="button"
          aria-label="Scroll featured listings left"
          onClick={() => scrollRail("prev")}
          className="absolute left-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm transition hover:bg-white md:inline-flex"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Scroll featured listings right"
          onClick={() => scrollRail("next")}
          className="absolute right-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm transition hover:bg-white md:inline-flex"
        >
          ›
        </button>
        <div
          ref={railRef}
          className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {featuredListings.map((listing, index) => {
            const imageUrl = getPrimaryImageUrl(listing);
            const imageLoaded = loadedById[listing.id] ?? false;
            const loadingProfile = resolveImageLoadingProfile(
              shouldPriorityImage({
                surface: "properties_list",
                index,
                slideIndex: 0,
                viewport: "mobile",
              })
            );

            return (
              <article
                key={listing.id}
                className="w-[220px] max-w-full shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white sm:w-[240px] lg:w-[280px]"
                data-testid={`host-featured-strip-card-${listing.id}`}
              >
                <Link
                  href={`/dashboard/properties/${listing.id}`}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                    <div
                      className={cn(
                        "absolute inset-0 z-[1] animate-pulse bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 transition-opacity duration-300",
                        imageLoaded ? "opacity-0" : "opacity-100"
                      )}
                      aria-hidden="true"
                    />
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={listing.title}
                        fill
                        sizes="(max-width: 640px) 60vw, (max-width: 1024px) 240px, 280px"
                        className="h-full w-full object-cover"
                        priority={loadingProfile.priority}
                        loading={loadingProfile.loading}
                        fetchPriority={loadingProfile.fetchPriority}
                        onLoad={() =>
                          setLoadedById((current) => ({
                            ...current,
                            [listing.id]: true,
                          }))
                        }
                      />
                    ) : (
                      <ListingImagePlaceholder />
                    )}
                  </div>
                  <div className="space-y-1 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusChipClass(
                          listing.status ?? null
                        )}`}
                      >
                        {mapStatusLabel(listing.status)}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-sm font-semibold text-slate-900">
                      {listing.title}
                    </p>
                    <p className="line-clamp-1 text-xs text-slate-500">
                      {listingLocationText(listing)}
                    </p>
                    <p className="text-xs font-semibold text-slate-800">
                      {formatListingPrice(listing)}
                    </p>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
