"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Property, UserRole } from "@/lib/types";
import { cn } from "@/components/ui/cn";
import { getPrimaryImageUrl } from "@/lib/properties/images";
import {
  formatCadence,
  formatListingType,
  formatLocationLabel,
  formatPriceValue,
  formatSizeLabel,
} from "@/lib/property-discovery";
import { TrustBadges } from "@/components/trust/TrustBadges";
import { TrustIdentityPill } from "@/components/trust/TrustIdentityPill";
import type { TrustMarkerState } from "@/lib/trust-markers";
import { SaveButton } from "@/components/properties/SaveButton";
import { PropertyTrustCues } from "@/components/properties/PropertyTrustCues";
import { Button } from "@/components/ui/Button";
import { buildTrustCues } from "@/lib/trust-cues";

const BedIcon = () => (
  <svg
    aria-hidden
    className="h-4 w-4 text-slate-500"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="M4 12V7a1 1 0 0 1 1-1h6v6" />
    <path d="M4 21v-3" />
    <path d="M20 21v-3" />
    <path d="M4 15h16v-3a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2Z" />
  </svg>
);

const BathIcon = () => (
  <svg
    aria-hidden
    className="h-4 w-4 text-slate-500"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
  >
    <path d="M7 4a3 3 0 1 1 6 0v6" />
    <path d="M4 10h14" />
    <path d="M5 20h12" />
    <path d="M5 16h14v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
    <path d="M15 4h1" />
    <path d="M15 7h2" />
  </svg>
);

type Props = {
  property: Property;
  href?: string;
  compact?: boolean;
  trustMarkers?: TrustMarkerState | null;
  trustVariant?: "public" | "admin";
  showSave?: boolean;
  initialSaved?: boolean;
  showCta?: boolean;
  viewerRole?: UserRole | null;
  fastResponder?: boolean;
};

export function PropertyCard({
  property,
  href,
  compact,
  trustMarkers,
  trustVariant = "public",
  showSave = false,
  initialSaved = false,
  showCta = false,
  viewerRole,
  fastResponder = false,
}: Props) {
  const fallbackImage =
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80";
  const primaryImage =
    getPrimaryImageUrl(property) || property.images?.[0]?.image_url || fallbackImage;
  const [imgSrc, setImgSrc] = useState(primaryImage);
  const blurDataURL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
  const locationLabel = formatLocationLabel(property.city, property.neighbourhood);
  const priceValue = formatPriceValue(property.currency, property.price);
  const cadence = formatCadence(property.rental_type, property.rent_period);
  const listingTypeLabel = formatListingType(property.listing_type);
  const sizeLabel = formatSizeLabel(property.size_value, property.size_unit);
  const metaLine = [listingTypeLabel, sizeLabel].filter(Boolean).join(" \u00b7 ");
  const listingIntent = property.listing_intent ?? "rent";
  const description =
    typeof property.description === "string" && property.description.trim().length > 0
      ? property.description
      : "No description provided yet.";
  const isFeaturedActive =
    !!property.is_featured &&
    (!property.featured_until || Date.parse(property.featured_until) > Date.now());
  const ctaLabel = listingIntent === "buy" ? "Enquire to buy" : "Request viewing";
  const cardHref = href || `/properties/${property.id}`;
  const trustCues = buildTrustCues({
    markers: trustMarkers,
    fastResponder,
    createdAt: property.created_at,
  });
  const hasTrustCues = trustCues.length > 0;

  const imageBlock = (
    <div
      className={cn(
        "relative",
        compact ? "h-32 w-32 flex-none" : "aspect-[4/3] w-full"
      )}
    >
      {href ? (
        <Link
          href={cardHref}
          aria-label={`View ${property.title}`}
          className="block h-full w-full"
        >
          <Image
            src={imgSrc}
            alt={property.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 320px"
            priority={false}
            placeholder="blur"
            blurDataURL={blurDataURL}
            onError={() => {
              if (imgSrc !== fallbackImage) setImgSrc(fallbackImage);
            }}
          />
        </Link>
      ) : (
        <Image
          src={imgSrc}
          alt={property.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 320px"
          priority={false}
          placeholder="blur"
          blurDataURL={blurDataURL}
          onError={() => {
            if (imgSrc !== fallbackImage) setImgSrc(fallbackImage);
          }}
        />
      )}
      {showSave && (
        <div className="absolute right-3 top-3 z-10">
          <SaveButton propertyId={property.id} initialSaved={initialSaved} variant="icon" />
        </div>
      )}
      {isFeaturedActive && (
        <span
          className="absolute left-3 top-3 z-10 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-700 shadow-sm"
          title="Featured by PropatyHub"
        >
          Featured
        </span>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "card h-full overflow-hidden rounded-2xl bg-white transition hover:-translate-y-0.5 hover:shadow-xl",
        compact && "flex"
      )}
    >
      {imageBlock}
      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {href ? (
              <Link href={cardHref} className="block">
                <p className="text-xs font-semibold text-slate-500">
                  {locationLabel}
                </p>
                {metaLine && (
                  <p className="text-xs text-slate-500">{metaLine}</p>
                )}
                <h3 className="text-base font-semibold text-slate-900 line-clamp-1">
                  {property.title}
                </h3>
              </Link>
            ) : (
              <>
                <p className="text-xs font-semibold text-slate-500">
                  {locationLabel}
                </p>
                {metaLine && (
                  <p className="text-xs text-slate-500">{metaLine}</p>
                )}
                <h3 className="text-base font-semibold text-slate-900 line-clamp-1">
                  {property.title}
                </h3>
              </>
            )}
          </div>
          <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-slate-600 whitespace-nowrap shrink-0">
            {listingIntent === "buy"
              ? "For sale"
              : property.rental_type === "short_let"
                ? "Short-let"
                : "Long-term"}
          </span>
        </div>
        <p className="min-h-[40px] text-sm text-slate-500 line-clamp-2">
          {description}
        </p>
        {trustMarkers && trustVariant === "admin" ? (
          <TrustBadges markers={trustMarkers} compact />
        ) : (
          (trustMarkers || hasTrustCues || isFeaturedActive) && (
            <div className="space-y-2">
              {trustMarkers && <TrustIdentityPill markers={trustMarkers} />}
              {hasTrustCues && (
                <PropertyTrustCues
                  markers={trustMarkers}
                  fastResponder={fastResponder}
                  createdAt={property.created_at}
                />
              )}
              {isFeaturedActive && (
                <p className="text-[11px] text-slate-500">Featured by PropatyHub</p>
              )}
            </div>
          )
        )}
        <div className="flex items-center justify-between text-sm text-slate-700">
          <div className="flex flex-wrap items-baseline gap-1 text-base font-semibold text-slate-900">
            {priceValue}
            {cadence && (
              <span className="text-xs font-normal text-slate-500 whitespace-nowrap">
                {` / ${cadence}`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <BedIcon />
              {property.bedrooms}
            </span>
            <span className="flex items-center gap-1">
              <BathIcon />
              {property.bathrooms}
            </span>
            <span>{property.furnished ? "Furnished" : "Unfurnished"}</span>
          </div>
        </div>
      </div>
      {showCta && !compact && (
        <div className="border-t border-slate-100 px-4 py-3">
          <Button
            variant="secondary"
            size="sm"
            data-testid="property-card-cta"
            onClick={() => {
              const target = `${cardHref}#cta`;
              const supabaseEnabled =
                !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
                !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
              const requiresAuth = supabaseEnabled && !viewerRole;
              if (requiresAuth) {
                window.location.href = `/auth/login?reason=auth&redirect=${encodeURIComponent(target)}`;
                return;
              }
              window.location.href = target;
            }}
          >
            {ctaLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
