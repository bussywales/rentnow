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
import type { TrustMarkerState } from "@/lib/trust-markers";
import { SaveButton } from "@/components/properties/SaveButton";
import { Button } from "@/components/ui/Button";
import { shouldRenderDemoBadge, shouldRenderDemoWatermark } from "@/lib/properties/demo";
import { isFeaturedListingActive } from "@/lib/properties/featured";
import { ListingTrustBadges } from "@/components/properties/ListingTrustBadges";
import type { ListingSocialProof } from "@/lib/properties/listing-trust-badges";
import { PublicPropertyShareButton } from "@/components/properties/PublicPropertyShareButton";
import {
  derivePublicAdvertiserName,
  resolvePublicAdvertiserHref,
} from "@/lib/advertisers/public-profile";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import { isSaleIntent, normalizeListingIntent } from "@/lib/listing-intents";
import {
  isShortletProperty,
  resolveShortletBookingMode,
  resolveShortletNightlyPriceMinor,
} from "@/lib/shortlet/discovery";

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
  socialProof?: ListingSocialProof | null;
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
  socialProof = null,
}: Props) {
  const { market } = useMarketPreference();
  const fallbackImage =
    "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80";
  const primaryImage =
    getPrimaryImageUrl(property) || property.images?.[0]?.image_url || fallbackImage;
  const [imgSrc, setImgSrc] = useState(primaryImage);
  const blurDataURL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
  const locationLabel = formatLocationLabel(property.city, property.neighbourhood);
  const isShortlet = isShortletProperty(property);
  const shortletMode = resolveShortletBookingMode(property);
  const shortletNightlyMinor = resolveShortletNightlyPriceMinor(property);
  const displayPriceValue =
    isShortlet &&
    typeof shortletNightlyMinor === "number" &&
    Number.isFinite(shortletNightlyMinor) &&
    shortletNightlyMinor > 0
      ? shortletNightlyMinor / 100
      : property.price;
  const priceValue = formatPriceValue(property.currency, displayPriceValue, {
    marketCurrency: market.currency,
  });
  const cadence = isShortlet ? "night" : formatCadence(property.rental_type, property.rent_period);
  const listingTypeLabel = formatListingType(property.listing_type);
  const sizeLabel = formatSizeLabel(property.size_value, property.size_unit);
  const metaLine = [listingTypeLabel, sizeLabel].filter(Boolean).join(" \u00b7 ");
  const listingIntent = normalizeListingIntent(property.listing_intent) ?? "rent_lease";
  const description =
    typeof property.description === "string" && property.description.trim().length > 0
      ? property.description
      : "No description provided yet.";
  const isDemo = !!property.is_demo;
  const isFeaturedActive = isFeaturedListingActive({
    is_featured: property.is_featured,
    featured_until: property.featured_until,
  });
  const showDemoBadge = shouldRenderDemoBadge({ isDemo, enabled: true });
  const showDemoWatermark = shouldRenderDemoWatermark({ isDemo, enabled: true });
  const ctaLabel = isShortlet
    ? shortletMode === "request"
      ? "Request to book"
      : "Reserve"
    : isSaleIntent(listingIntent)
    ? "Enquire to buy"
    : "Request viewing";
  const cardHref = href || `/properties/${property.id}`;
  const showFastResponder = !!fastResponder;
  const advertiserName = property.owner_id
    ? derivePublicAdvertiserName({
        display_name: property.owner_display_name ?? property.owner_profile?.display_name ?? null,
        full_name: property.owner_profile?.full_name ?? null,
        business_name: property.owner_profile?.business_name ?? null,
      })
    : "";
  const showAdvertiserLink = !!property.owner_id && advertiserName !== "Advertiser";
  const advertiserHref =
    resolvePublicAdvertiserHref({
      advertiserId: property.owner_id,
      publicSlug: property.owner_profile?.public_slug ?? null,
    }) ?? (property.owner_id ? `/u/${property.owner_id}` : null);

  const imageBlock = (
    <div
      className={cn(
        "relative",
        compact
          ? "h-40 w-full shrink-0 flex-none min-[360px]:h-32 min-[360px]:w-32"
          : "aspect-[4/3] w-full"
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
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        {showSave && (
          <SaveButton propertyId={property.id} initialSaved={initialSaved} variant="icon" />
        )}
        <PublicPropertyShareButton propertyId={property.id} surface="property_card" />
      </div>
      {showDemoBadge && (
        <div className="absolute left-3 top-3 z-10 flex flex-col gap-1">
          {showDemoBadge && (
            <span
              className="property-demo-badge rounded-full bg-slate-900/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white shadow-sm"
              title="Demo listing"
            >
              Demo
            </span>
          )}
        </div>
      )}
      {showDemoWatermark && (
        <div
          className={cn(
            "property-demo-watermark pointer-events-none absolute inset-0 z-[2] flex items-center justify-center font-black uppercase tracking-[0.35em] text-white/35",
            compact ? "text-xl" : "text-4xl"
          )}
          aria-hidden
        >
          Demo
        </div>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "card h-full min-w-0 overflow-hidden rounded-2xl bg-white transition hover:-translate-y-0.5 hover:shadow-xl",
        compact && "flex flex-col min-[360px]:flex-row"
      )}
      data-testid="property-card"
    >
      {imageBlock}
      <div className="flex min-w-0 flex-1 flex-col gap-2 px-4 py-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {href ? (
              <Link href={cardHref} className="block">
                <p className="text-xs font-semibold text-slate-500">
                  {locationLabel}
                </p>
                {metaLine && (
                  <p className="text-xs text-slate-500 break-words">{metaLine}</p>
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
                  <p className="text-xs text-slate-500 break-words">{metaLine}</p>
                )}
                <h3 className="text-base font-semibold text-slate-900 line-clamp-1">
                  {property.title}
                </h3>
              </>
            )}
            {showAdvertiserLink && (
              <p className="text-xs text-slate-500">
                By{" "}
                <Link
                  href={advertiserHref ?? `/u/${property.owner_id}`}
                  className="font-semibold text-slate-700 hover:text-sky-700"
                >
                  {advertiserName}
                </Link>
              </p>
            )}
          </div>
          <span className="rounded-full border border-slate-200/70 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-slate-600 whitespace-nowrap shrink-0">
            {isSaleIntent(listingIntent)
              ? "For sale"
              : isShortlet
                ? "Shortlet"
                : listingIntent === "off_plan"
                  ? "Off-plan"
              : property.rental_type === "short_let"
                ? "Short-let"
                : "Long-term"}
          </span>
        </div>
        {trustVariant !== "admin" && (
          <ListingTrustBadges
            createdAt={property.created_at}
            trustMarkers={trustMarkers}
            socialProof={socialProof}
            featured={isFeaturedActive}
          />
        )}
        {showFastResponder && trustVariant !== "admin" && (
          <span className="inline-flex w-fit rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            Fast responder
          </span>
        )}
        {isShortlet && (
          <span className="inline-flex w-fit rounded-full border border-sky-100 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
            {shortletMode === "request" ? "Shortlet - Request to book" : "Shortlet - Instant book"}
          </span>
        )}
        <p className="min-h-[40px] text-sm text-slate-500 line-clamp-2">
          {description}
        </p>
        {trustMarkers && trustVariant === "admin" && <TrustBadges markers={trustMarkers} compact />}
        <div className="flex flex-col items-start gap-2 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-baseline gap-1 text-base font-semibold text-slate-900">
            {priceValue}
            {cadence && (
              <span className="text-xs font-normal text-slate-500 whitespace-nowrap">
                {` / ${cadence}`}
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <BedIcon />
              <span data-testid="property-card-bedrooms">{property.bedrooms}</span>
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
