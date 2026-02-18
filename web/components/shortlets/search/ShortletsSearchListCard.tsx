"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Property } from "@/lib/types";
import { cn } from "@/components/ui/cn";
import { formatLocationLabel } from "@/lib/property-discovery";
import { resolveShortletBookingMode, resolveShortletNightlyPriceMinor } from "@/lib/shortlet/discovery";

type Props = {
  property: Property & {
    primaryImageUrl?: string | null;
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
  if (typeof nightlyMinor !== "number" || nightlyMinor <= 0) return "Nightly price unavailable";
  const value = nightlyMinor / 100;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || "NGN"} ${value.toFixed(0)}`;
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
  const [imageSrc, setImageSrc] = useState(property.primaryImageUrl || property.cover_image_url || FALLBACK_IMAGE);
  const location = formatLocationLabel(property.city, property.neighbourhood);
  const bookingMode = resolveShortletBookingMode(property);
  const nightlyMinor = resolveShortletNightlyPriceMinor(property);
  const priceLabel = formatNightlyPrice(property.currency, nightlyMinor);
  const showNewBadge = useMemo(() => isNewListing(property.created_at), [property.created_at]);

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
      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
        <div className="relative h-44 w-full sm:h-48">
          <Image
            src={imageSrc}
            alt={property.title}
            fill
            sizes="(max-width: 1024px) 100vw, 520px"
            className="object-cover"
            onError={() => setImageSrc(FALLBACK_IMAGE)}
          />
        </div>
        <div className="space-y-2 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{location}</p>
            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {bookingMode === "instant" ? "Instant" : "Request"}
            </span>
          </div>
          <h3 className="line-clamp-1 text-base font-semibold text-slate-900">{property.title}</h3>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">
              {priceLabel}
              <span className="font-normal text-slate-500"> / night</span>
            </p>
            <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500">
              {showNewBadge ? "New" : "Top stay"}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
