"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { HostListingActionsMenu } from "@/components/host/HostListingActionsMenu";
import { resolveStableListingImageSrc } from "@/lib/host/listing-image-stability";
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

export function HostListingsRail({ listings }: Props) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const stableImageSrcByListingId = useMemo(() => new Map<string, string | null>(), []);
  const [loadedById, setLoadedById] = useState<Record<string, boolean>>({});

  const scrollRail = (direction: "prev" | "next") => {
    const rail = railRef.current;
    if (!rail) return;
    const distance = direction === "next" ? 332 : -332;
    rail.scrollBy({ left: distance, behavior: "smooth" });
  };

  if (listings.length === 0) {
    return (
      <section
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        data-testid="host-home-listings-rail"
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
      className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
      data-testid="host-home-listings-rail"
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            My listings
          </p>
          <h2 className="text-lg font-semibold text-slate-900">Your media feed</h2>
        </div>
        <Link
          href="/host/listings?view=manage"
          className="text-xs font-semibold text-sky-700 hover:text-sky-800"
        >
          Manage all
        </Link>
      </div>
      <div className="group relative">
        <button
          type="button"
          aria-label="Scroll listings left"
          onClick={() => scrollRail("prev")}
          className="absolute left-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm transition hover:bg-white md:inline-flex md:opacity-0 md:group-hover:opacity-100"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Scroll listings right"
          onClick={() => scrollRail("next")}
          className="absolute right-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm transition hover:bg-white md:inline-flex md:opacity-0 md:group-hover:opacity-100"
        >
          ›
        </button>
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] hidden w-8 bg-gradient-to-r from-white to-transparent md:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] hidden w-8 bg-gradient-to-l from-white to-transparent md:block" />
        <div
          ref={railRef}
          className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {listings.map((listing) => {
            const imageUrl = resolveStableListingImageSrc(
              stableImageSrcByListingId,
              listing.id,
              getPrimaryImageUrl(listing)
            );
            const imageLoaded = loadedById[listing.id] ?? false;
            return (
              <article
                key={listing.id}
                className="flex h-[284px] w-[286px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white md:w-[312px]"
                data-testid={`host-home-listings-rail-card-${listing.id}`}
              >
                <div className="relative h-44 w-full bg-slate-100">
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 transition-opacity duration-300",
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
                      sizes="(max-width: 768px) 88vw, 320px"
                      className="object-cover"
                      onLoad={() =>
                        setLoadedById((current) =>
                          current[listing.id] ? current : { ...current, [listing.id]: true }
                        )
                      }
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-100" />
                  )}
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusChipClass(
                        listing.status ?? null
                      )}`}
                    >
                      {mapStatusLabel(listing.status)}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Score {listing.readiness.score}
                    </span>
                  </div>
                  <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{listing.title}</h3>
                  <p className="line-clamp-1 text-xs text-slate-500">{listingLocationText(listing)}</p>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <Link
                      href={`/host/properties/${listing.id}/edit`}
                      className="inline-flex items-center rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                    >
                      Manage
                    </Link>
                    <HostListingActionsMenu listingId={listing.id} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
