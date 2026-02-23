"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { ListingImagePlaceholder } from "@/components/ui/ListingImagePlaceholder";
import { resolveImageLoadingProfile, shouldPriorityImage } from "@/lib/images/loading-profile";
import { getPrimaryImageUrl } from "@/lib/properties/images";
import type { Property } from "@/lib/types";

type Props = {
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  listings: Property[];
  source: string;
  sectionTestId: string;
};

function formatPrice(property: Property): string {
  const amount = Number.isFinite(property.price) ? Number(property.price) : 0;
  if (!amount || amount <= 0) return "Price on request";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: property.currency || "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function locationLabel(property: Property): string {
  return property.location_label || property.city || property.admin_area_1 || "Location not set";
}

export function HomeListingRail({
  title,
  subtitle,
  href,
  hrefLabel = "View all",
  listings,
  source,
  sectionTestId,
}: Props) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const checkOverflow = () => {
      setHasOverflow(rail.scrollWidth - rail.clientWidth > 4);
    };

    checkOverflow();
    const rafId = window.requestAnimationFrame(checkOverflow);
    window.addEventListener("resize", checkOverflow);
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(checkOverflow) : null;
    observer?.observe(rail);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", checkOverflow);
      observer?.disconnect();
    };
  }, [listings.length]);

  const scrollRail = (direction: "prev" | "next") => {
    const rail = railRef.current;
    if (!rail) return;
    const firstCard = rail.querySelector("[data-home-rail-card]") as HTMLElement | null;
    const cardWidth = firstCard?.clientWidth || 260;
    const distance = direction === "next" ? cardWidth + 12 : -(cardWidth + 12);
    rail.scrollBy({ left: distance, behavior: "smooth" });
  };

  if (!listings.length) return null;

  return (
    <section
      className="space-y-3 overflow-x-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      data-testid={sectionTestId}
    >
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {title}
          </p>
          {subtitle ? <h2 className="text-base font-semibold text-slate-900">{subtitle}</h2> : null}
        </div>
        {href ? (
          <Link href={href} className="text-xs font-semibold text-sky-700 hover:text-sky-800">
            {hrefLabel}
          </Link>
        ) : null}
      </div>
      <div className="group relative">
        {hasOverflow ? (
          <>
            <button
              type="button"
              onClick={() => scrollRail("prev")}
              aria-label={`Scroll ${title} left`}
              className="absolute left-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 opacity-0 shadow-sm transition hover:bg-white md:inline-flex md:group-hover:opacity-100"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => scrollRail("next")}
              aria-label={`Scroll ${title} right`}
              className="absolute right-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 opacity-0 shadow-sm transition hover:bg-white md:inline-flex md:group-hover:opacity-100"
            >
              ›
            </button>
          </>
        ) : null}
        {hasOverflow ? (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] hidden w-8 bg-gradient-to-r from-white to-transparent md:block" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] hidden w-8 bg-gradient-to-l from-white to-transparent md:block" />
          </>
        ) : null}
        <div
          ref={railRef}
          className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1 pr-4 scroll-px-4 sm:px-6 sm:pr-6 sm:scroll-px-6"
        >
          {listings.map((listing, index) => {
            const imageUrl = getPrimaryImageUrl(listing);
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
                className="w-[220px] max-w-full shrink-0 snap-start snap-always overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-within:-translate-y-0.5 focus-within:shadow-md sm:w-[240px] lg:w-[280px]"
                data-home-rail-card
                data-testid={`${
                  sectionTestId === "home-featured-strip"
                    ? "host-featured-strip-card"
                    : `${sectionTestId}-card`
                }-${listing.id}`}
              >
                <Link
                  href={`/properties/${listing.id}?source=${encodeURIComponent(source)}`}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={listing.title}
                        fill
                        sizes="(max-width: 640px) 60vw, (max-width: 1024px) 240px, 280px"
                        className={cn("h-full w-full object-cover")}
                        priority={loadingProfile.priority}
                        loading={loadingProfile.loading}
                        fetchPriority={loadingProfile.fetchPriority}
                      />
                    ) : (
                      <ListingImagePlaceholder />
                    )}
                  </div>
                  <div className="space-y-1 p-2.5">
                    <p className="line-clamp-1 text-sm font-semibold text-slate-900">{listing.title}</p>
                    <p className="line-clamp-1 text-xs text-slate-500">{locationLabel(listing)}</p>
                    <p className="text-xs font-semibold text-slate-800">{formatPrice(listing)}</p>
                  </div>
                </Link>
              </article>
            );
          })}
          <div className="w-4 shrink-0 sm:w-6" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
