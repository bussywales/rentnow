"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { ListingImagePlaceholder } from "@/components/ui/ListingImagePlaceholder";
import { resolveStableListingImageSrc } from "@/lib/host/listing-image-stability";
import { resolveImageLoadingProfile, shouldPriorityImage } from "@/lib/images/loading-profile";
import { selectHostFeaturedStripListings } from "@/lib/host/featured-strip";
import { getPrimaryImageUrl } from "@/lib/properties/images";
import { mapStatusLabel, normalizePropertyStatus } from "@/lib/properties/status";
import type { DashboardListing } from "@/lib/properties/host-dashboard";

type Props = {
  listings: DashboardListing[];
  mosaicTargetId?: string;
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

export function HostFeaturedStrip({
  listings,
  mosaicTargetId = "host-home-listings-grid",
}: Props) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const stableImageSrcByListingId = useMemo(() => new Map<string, string | null>(), []);
  const [loadedById, setLoadedById] = useState<Record<string, boolean>>({});
  const [hasOverflow, setHasOverflow] = useState(false);
  const featuredListings = useMemo(
    () => selectHostFeaturedStripListings(listings),
    [listings]
  );

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const checkOverflow = () => {
      const nextHasOverflow = rail.scrollWidth - rail.clientWidth > 4;
      setHasOverflow(nextHasOverflow);
    };

    checkOverflow();
    const rafId = window.requestAnimationFrame(checkOverflow);
    window.addEventListener("resize", checkOverflow);
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(checkOverflow);
      resizeObserver.observe(rail);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", checkOverflow);
      resizeObserver?.disconnect();
    };
  }, [featuredListings.length]);

  const scrollRail = (direction: "prev" | "next") => {
    const rail = railRef.current;
    if (!rail) return;
    const firstCard = rail.firstElementChild as HTMLElement | null;
    const cardWidth = firstCard?.clientWidth || 280;
    const distance = direction === "next" ? cardWidth + 12 : -(cardWidth + 12);
    rail.scrollBy({ left: distance, behavior: "smooth" });
  };

  if (featuredListings.length === 0) return null;

  const scrollToMosaic = () => {
    const target = document.getElementById(mosaicTargetId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section
      className="space-y-3 overflow-x-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="host-featured-strip"
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Featured listings
          </p>
          <h2 className="text-base font-semibold text-slate-900">Curated highlights</h2>
        </div>
        <button
          type="button"
          onClick={scrollToMosaic}
          className="text-xs font-semibold text-sky-700 hover:text-sky-800"
        >
          View all
        </button>
      </div>

      <div className="group relative">
        {hasOverflow ? (
          <>
            <button
              type="button"
              aria-label="Scroll featured listings left"
              onClick={() => scrollRail("prev")}
              className="absolute left-5 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 opacity-0 shadow-sm transition hover:bg-white md:inline-flex md:group-hover:opacity-100"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Scroll featured listings right"
              onClick={() => scrollRail("next")}
              className="absolute right-5 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 opacity-0 shadow-sm transition hover:bg-white md:inline-flex md:group-hover:opacity-100"
            >
              ›
            </button>
          </>
        ) : null}
        {hasOverflow ? (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] hidden w-10 bg-gradient-to-r from-white to-transparent md:block" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] hidden w-10 bg-gradient-to-l from-white to-transparent md:block" />
          </>
        ) : null}
        <div
          ref={railRef}
          className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-5 pb-1 pr-5 scroll-px-5 sm:px-7 sm:pr-7 sm:scroll-px-7"
        >
          {featuredListings.map((listing, index) => {
            const imageUrl = resolveStableListingImageSrc(
              stableImageSrcByListingId,
              listing.id,
              getPrimaryImageUrl(listing)
            );
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
                className="w-[220px] max-w-full shrink-0 snap-start snap-always overflow-hidden rounded-2xl border border-slate-200 bg-white sm:w-[240px] lg:w-[280px]"
                data-testid={`host-featured-strip-card-${listing.id}`}
              >
                <Link
                  href={`/dashboard/properties/${listing.id}`}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                    <div
                      className={cn(
                        "absolute inset-0 z-[1] bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200",
                        imageLoaded ? "opacity-0" : "opacity-100"
                      )}
                      aria-hidden="true"
                    />
                    {imageUrl ? (
                      <Image
                        key={`listing-image-${listing.id}`}
                        src={imageUrl}
                        alt={listing.title}
                        fill
                        sizes="(max-width: 640px) 60vw, (max-width: 1024px) 240px, 280px"
                        className="h-full w-full object-cover"
                        priority={loadingProfile.priority}
                        loading={loadingProfile.loading}
                        fetchPriority={loadingProfile.fetchPriority}
                        onLoad={() => {
                          setLoadedById((current) =>
                            current[listing.id]
                              ? current
                              : {
                                  ...current,
                                  [listing.id]: true,
                                }
                          );
                        }}
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
          <div className="w-5 shrink-0 sm:w-7" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
