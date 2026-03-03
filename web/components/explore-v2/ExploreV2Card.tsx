"use client";

import { memo, useMemo } from "react";
import type { Property } from "@/lib/types";
import { resolveImagePlaceholder } from "@/lib/images/placeholders";
import { resolveExploreIntentTag, resolveExplorePriceCopy } from "@/lib/explore/explore-presentation";

type ExploreV2CardProps = {
  listing: Property;
  marketCurrency: string | null;
};

function resolveExploreV2LocationLine(listing: Property): string {
  const parts = [listing.city, listing.country_code ?? listing.country]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  if (parts.length === 0) return "Location available on details";
  return parts.join(", ");
}

function resolveExploreV2PlaceholderStyle(listing: Property) {
  const firstImage = listing.images?.[0];
  const placeholder = resolveImagePlaceholder({
    dominantColor: firstImage?.dominant_color ?? firstImage?.dominantColor,
    blurhash: firstImage?.blurhash,
    imageUrl: firstImage?.image_url ?? listing.cover_image_url ?? listing.id,
  });
  return {
    backgroundColor: placeholder.dominantColor,
    backgroundImage: `url("${placeholder.blurDataURL}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  } as const;
}

function ExploreV2CardInner({ listing, marketCurrency }: ExploreV2CardProps) {
  const placeholderStyle = useMemo(() => resolveExploreV2PlaceholderStyle(listing), [listing]);
  const price = useMemo(
    () => resolveExplorePriceCopy(listing, { marketCurrency, stayContext: null }),
    [listing, marketCurrency]
  );
  const intentTag = useMemo(() => resolveExploreIntentTag(listing), [listing]);
  const locationLine = useMemo(() => resolveExploreV2LocationLine(listing), [listing]);

  return (
    <article
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
      data-testid="explore-v2-card"
    >
      <div className="relative aspect-[4/5] min-h-[320px] w-full overflow-hidden" style={placeholderStyle}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/25" />
        <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-700">
          Preview
        </span>
      </div>
      <div className="space-y-1.5 px-4 py-3">
        <p className="truncate text-sm font-semibold text-slate-900">{listing.title || "Untitled listing"}</p>
        <p className="truncate text-xs text-slate-500">{locationLine}</p>
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold text-slate-900">{price.primary}</p>
          <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            {intentTag}
          </span>
        </div>
      </div>
    </article>
  );
}

export const ExploreV2Card = memo(ExploreV2CardInner);
