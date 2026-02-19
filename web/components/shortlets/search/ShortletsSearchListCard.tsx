"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Property } from "@/lib/types";
import { cn } from "@/components/ui/cn";
import { formatLocationLabel } from "@/lib/property-discovery";
import { resolveShortletBookingMode, resolveShortletNightlyPriceMinor } from "@/lib/shortlet/discovery";
import { ShortletsSearchCardCarousel } from "@/components/shortlets/search/ShortletsSearchCardCarousel";

type Props = {
  property: Property & {
    primaryImageUrl?: string | null;
    imageUrls?: string[];
    imageCount?: number;
    verifiedHost?: boolean;
    cancellationPolicy?: "flexible_24h" | "flexible_48h" | "moderate_5d" | "strict";
    cancellationLabel?: string;
  };
  href: string;
  selected?: boolean;
  highlighted?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80";

function formatNightlyPrice(currency: string, nightlyMinor: number | null): string {
  if (typeof nightlyMinor !== "number" || nightlyMinor <= 0) return "Price on request";
  const value = nightlyMinor / 100;
  try {
    const formatted = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 0,
    }).format(value);
    return `${formatted} / night`;
  } catch {
    return `${currency || "NGN"} ${value.toFixed(0)} / night`;
  }
}

function isNewListing(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  const createdAtMs = Date.parse(createdAt);
  if (!Number.isFinite(createdAtMs)) return false;
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - createdAtMs <= THIRTY_DAYS_MS;
}

export function ShortletsSearchListCard({
  property,
  href,
  selected = false,
  highlighted = false,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
}: Props) {
  const location = formatLocationLabel(property.city, property.neighbourhood);
  const bookingMode = resolveShortletBookingMode(property);
  const nightlyMinor = resolveShortletNightlyPriceMinor(property);
  const priceLabel = formatNightlyPrice(property.currency, nightlyMinor);
  const showNewBadge = useMemo(() => isNewListing(property.created_at), [property.created_at]);
  const ctaLabel = bookingMode === "instant" ? "Reserve" : bookingMode === "request" ? "Request" : "View";
  const badgeLabel = property.verifiedHost ? "Verified" : property.is_featured ? "Featured" : showNewBadge ? "New" : null;
  const cancellationLabel = property.cancellationLabel ?? "Cancellation policy: Strict";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition",
        highlighted && "border-sky-300 ring-2 ring-sky-100",
        selected && "border-sky-400 ring-2 ring-sky-200"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      data-testid="shortlets-search-list-card"
    >
      <ShortletsSearchCardCarousel
        title={property.title}
        href={href}
        coverImageUrl={property.cover_image_url}
        primaryImageUrl={property.primaryImageUrl}
        imageUrls={property.imageUrls}
        images={property.images ?? undefined}
        fallbackImage={FALLBACK_IMAGE}
      />
      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
        <div className="space-y-2 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{location}</p>
            {badgeLabel ? (
              <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {badgeLabel}
              </span>
            ) : null}
          </div>
          <h3 className="line-clamp-1 text-base font-semibold text-slate-900">{property.title}</h3>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">{priceLabel}</p>
            <span className="inline-flex h-8 items-center rounded-full bg-slate-900 px-3 text-xs font-semibold text-white">
              {ctaLabel}
            </span>
          </div>
          <p className="truncate text-xs text-slate-500">{cancellationLabel}</p>
        </div>
      </Link>
    </article>
  );
}
