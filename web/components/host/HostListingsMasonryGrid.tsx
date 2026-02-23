"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { resolveStableListingImageSrc } from "@/lib/host/listing-image-stability";
import { ListingImagePlaceholder } from "@/components/ui/ListingImagePlaceholder";
import { getPrimaryImageUrl } from "@/lib/properties/images";
import { mapStatusLabel, normalizePropertyStatus } from "@/lib/properties/status";
import { resolveImageLoadingProfile, shouldPriorityImage } from "@/lib/images/loading-profile";
import {
  getHostListingTileAspectClass,
  getHostListingTilePattern,
} from "@/lib/host/listings-grid-pattern";
import type { DashboardListing } from "@/lib/properties/host-dashboard";

type Props = {
  listings: DashboardListing[];
  uniformMedia?: boolean;
};

const MAX_GRID_LISTINGS = 12;

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

export function HostListingsMasonryGrid({ listings, uniformMedia = false }: Props) {
  const stableImageSrcByListingId = useMemo(() => new Map<string, string | null>(), []);
  const visibleListings = listings.slice(0, MAX_GRID_LISTINGS);
  const [loadedById, setLoadedById] = useState<Record<string, boolean>>({});

  if (!visibleListings.length) {
    return (
      <section
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        data-testid="host-home-listings-grid"
      >
        <p className="text-sm font-semibold text-slate-900">My listings</p>
        <p className="mt-1 text-sm text-slate-600">
          Publish your first listing to unlock the media feed.
        </p>
      </section>
    );
  }

  return (
    <section
      id="host-home-listings-grid"
      className="-mx-4 space-y-2.5 rounded-none bg-slate-50/70 px-4 py-3.5 sm:mx-0 sm:rounded-2xl sm:border sm:border-slate-200 sm:bg-white sm:p-4 sm:shadow-sm"
      data-testid="host-home-listings-grid"
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            All listings
          </p>
          <h2 className="text-lg font-semibold text-slate-900">Portfolio mosaic</h2>
        </div>
        <Link
          href="/host/properties"
          className="text-xs font-semibold text-sky-700 hover:text-sky-800"
        >
          Manage all
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
        {visibleListings.map((listing, index) => {
          const imageUrl = resolveStableListingImageSrc(
            stableImageSrcByListingId,
            listing.id,
            getPrimaryImageUrl(listing)
          );
          const pattern = getHostListingTilePattern(index);
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
              className={cn(
                "group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm transition duration-200",
                "hover:-translate-y-0.5 hover:shadow-md focus-within:-translate-y-0.5 focus-within:shadow-md",
                "w-full max-w-full"
              )}
              data-testid={`host-home-listings-grid-card-${listing.id}`}
            >
                <div
                  className={cn(
                    "relative w-full max-w-full overflow-hidden bg-slate-100",
                    "max-h-[60vh]",
                    uniformMedia ? "aspect-[4/3]" : getHostListingTileAspectClass(pattern)
                  )}
                >
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
                    sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.01] group-focus-within:scale-[1.01]"
                    priority={loadingProfile.priority}
                    loading={loadingProfile.loading}
                    fetchPriority={loadingProfile.fetchPriority}
                    onLoad={() =>
                      setLoadedById((current) =>
                        current[listing.id]
                          ? current
                          : { ...current, [listing.id]: true }
                      )
                    }
                  />
                ) : (
                  <ListingImagePlaceholder />
                )}
                <div className="absolute inset-x-0 top-0 z-[1] flex items-start justify-between p-2.5">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur ${statusChipClass(
                      listing.status ?? null
                    )}`}
                  >
                    {mapStatusLabel(listing.status)}
                  </span>
                </div>

                <div className="absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent p-2.5">
                  <h3 className="line-clamp-1 text-sm font-semibold text-white">{listing.title}</h3>
                  <p className="line-clamp-1 text-xs text-slate-200">{listingLocationText(listing)}</p>
                  <Link
                    href={`/dashboard/properties/${listing.id}`}
                    className="mt-2 inline-flex items-center rounded-md bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-900 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    Open listing
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
