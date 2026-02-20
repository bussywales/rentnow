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
    freeCancellation?: boolean;
    cancellationPolicy?: "flexible_24h" | "flexible_48h" | "moderate_5d" | "strict";
    cancellationLabel?: string;
  };
  href: string;
  selected?: boolean;
  highlighted?: boolean;
  isSaved?: boolean;
  onToggleSaved?: () => void;
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

const POWER_BACKUP_TOKENS = ["generator", "gen", "inverter", "power backup", "backup power"];
const SECURITY_TOKENS = ["security", "gated", "guard", "cctv"];
const BOREHOLE_TOKENS = ["borehole", "water"];

function normalizeAmenities(values: string[] | null | undefined): string[] {
  return (values ?? [])
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
}

function includesAnyAmenity(amenities: string[], tokens: readonly string[]): boolean {
  return tokens.some((token) => amenities.some((amenity) => amenity.includes(token)));
}

export function resolveShortletsSearchCardHighlight(amenities: string[] | null | undefined): string | null {
  const normalized = normalizeAmenities(amenities);
  if (!normalized.length) return null;
  if (includesAnyAmenity(normalized, POWER_BACKUP_TOKENS)) return "Power backup";
  if (includesAnyAmenity(normalized, SECURITY_TOKENS)) return "Security / gated";
  if (includesAnyAmenity(normalized, BOREHOLE_TOKENS)) return "Borehole water";
  return null;
}

export function resolveShortletsSearchCardBadge(input: {
  freeCancellation?: boolean;
  verifiedHost?: boolean;
  bookingMode: ReturnType<typeof resolveShortletBookingMode>;
}): string | null {
  if (input.freeCancellation) return "Free cancellation";
  if (input.verifiedHost) return "Verified host";
  if (input.bookingMode === "instant") return "Instant book";
  return null;
}

export function ShortletsSearchListCard({
  property,
  href,
  selected = false,
  highlighted = false,
  isSaved = false,
  onToggleSaved,
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
  const highlightLabel = useMemo(
    () => resolveShortletsSearchCardHighlight(property.amenities),
    [property.amenities]
  );
  const badgeLabel = resolveShortletsSearchCardBadge({
    freeCancellation: property.freeCancellation,
    verifiedHost: property.verifiedHost,
    bookingMode,
  });

  return (
    <article
      className={cn(
        "relative h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition",
        highlighted && "border-sky-300 ring-2 ring-sky-100",
        selected && "border-sky-400 ring-2 ring-sky-200"
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      data-testid="shortlets-search-list-card"
    >
      <button
        type="button"
        aria-label={isSaved ? "Remove from shortlist" : "Save to shortlist"}
        aria-pressed={isSaved}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleSaved?.();
        }}
        className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        <span className={cn("text-base leading-none", isSaved ? "text-rose-500" : "text-slate-600")}>
          {isSaved ? "♥" : "♡"}
        </span>
      </button>
      <ShortletsSearchCardCarousel
        title={property.title}
        href={href}
        coverImageUrl={property.cover_image_url}
        primaryImageUrl={property.primaryImageUrl}
        imageUrls={property.imageUrls}
        images={property.images ?? undefined}
        fallbackImage={FALLBACK_IMAGE}
      />
      <Link href={href} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
        <div className="flex min-h-[164px] flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {location}
            </p>
            {badgeLabel ? (
              <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {badgeLabel}
              </span>
            ) : showNewBadge ? (
              <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                New
              </span>
            ) : null}
          </div>
          <h3 className="line-clamp-2 min-h-[2.8rem] text-base font-semibold text-slate-900">{property.title}</h3>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">{priceLabel}</p>
            <span className="inline-flex h-8 items-center rounded-full bg-slate-900 px-3 text-xs font-semibold text-white">
              {ctaLabel}
            </span>
          </div>
          {highlightLabel ? (
            <p className="truncate text-xs text-slate-500">{highlightLabel}</p>
          ) : (
            <p className="truncate text-xs text-slate-500">Calm, bookable stay</p>
          )}
        </div>
      </Link>
    </article>
  );
}
