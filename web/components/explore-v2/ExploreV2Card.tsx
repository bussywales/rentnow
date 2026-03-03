"use client";

import { memo, useMemo, useState } from "react";
import Image from "next/image";
import type { ImageLoader } from "next/image";
import { cn } from "@/components/ui/cn";
import type { Property } from "@/lib/types";
import { resolveImagePlaceholder } from "@/lib/images/placeholders";
import { resolveExploreIntentTag, resolveExplorePriceCopy } from "@/lib/explore/explore-presentation";
import { shouldBypassNextImageOptimizer } from "@/lib/images/optimizer-bypass";
import { resolveExploreHeroImageUrl } from "@/lib/explore/gallery-images";

type ExploreV2CardProps = {
  listing: Property;
  marketCurrency: string | null;
};

export type ExploreV2HeroLoadState = "loading" | "loaded" | "error";

const directImageLoader: ImageLoader = ({ src }) => src;

function resolveExploreV2LocationLine(listing: Property): string {
  const parts = [listing.city, listing.country_code ?? listing.country]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  if (parts.length === 0) return "Location available on details";
  return parts.join(", ");
}

function resolveExploreV2PlaceholderStyle(listing: Property) {
  const heroImage = resolveExploreHeroImageUrl(listing);
  const placeholder = resolveImagePlaceholder({
    dominantColor: heroImage.meta?.dominantColor ?? null,
    blurhash: heroImage.meta?.blurhash ?? null,
    imageUrl: heroImage.url ?? listing.cover_image_url ?? listing.id,
  });
  return {
    backgroundColor: placeholder.dominantColor,
    backgroundImage: `url("${placeholder.blurDataURL}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  } as const;
}

export function reduceExploreV2HeroLoadState(
  current: ExploreV2HeroLoadState,
  event: "load" | "error" | "reset"
): ExploreV2HeroLoadState {
  if (event === "reset") return "loading";
  if (event === "load") return "loaded";
  if (current === "loaded" && event === "error") return current;
  return "error";
}

export function resolveExploreV2HeroRenderState(input: {
  heroImageUrl: string | null;
  loadState: ExploreV2HeroLoadState;
}) {
  const hasImageUrl = Boolean(input.heroImageUrl);
  const shouldRenderImage = hasImageUrl && input.loadState !== "error";
  return {
    shouldRenderImage,
    showUnavailableBadge: !hasImageUrl || input.loadState === "error",
    imageOpacityClass: input.loadState === "loaded" ? "opacity-100" : "opacity-0",
    placeholderPersistent: true,
  };
}

function ExploreV2CardInner({ listing, marketCurrency }: ExploreV2CardProps) {
  const heroImage = useMemo(() => resolveExploreHeroImageUrl(listing), [listing]);
  const placeholderStyle = useMemo(() => resolveExploreV2PlaceholderStyle(listing), [listing]);
  const price = useMemo(
    () => resolveExplorePriceCopy(listing, { marketCurrency, stayContext: null }),
    [listing, marketCurrency]
  );
  const intentTag = useMemo(() => resolveExploreIntentTag(listing), [listing]);
  const locationLine = useMemo(() => resolveExploreV2LocationLine(listing), [listing]);
  const [loadedHeroUrl, setLoadedHeroUrl] = useState<string | null>(null);
  const [failedHeroUrl, setFailedHeroUrl] = useState<string | null>(null);
  const heroLoadState: ExploreV2HeroLoadState =
    heroImage.url && failedHeroUrl === heroImage.url
      ? "error"
      : heroImage.url && loadedHeroUrl === heroImage.url
        ? "loaded"
        : "loading";
  const bypassOptimizer = heroImage.url ? shouldBypassNextImageOptimizer(heroImage.url) : false;
  const heroRenderState = resolveExploreV2HeroRenderState({
    heroImageUrl: heroImage.url,
    loadState: heroLoadState,
  });

  return (
    <article
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
      data-testid="explore-v2-card"
    >
      <div
        className="relative aspect-[4/5] min-h-[320px] w-full overflow-hidden"
        style={placeholderStyle}
        data-testid="explore-v2-hero"
      >
        <div
          className="absolute inset-0 scale-[1.04]"
          style={placeholderStyle}
          data-placeholder-persistent={heroRenderState.placeholderPersistent ? "true" : "false"}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/25" />
        {heroRenderState.shouldRenderImage && heroImage.url ? (
          <Image
            src={heroImage.url}
            alt={listing.title || "Explore listing image"}
            fill
            sizes="(max-width: 768px) 100vw, 460px"
            className={cn(
              "select-none object-cover transition-opacity duration-300",
              heroRenderState.imageOpacityClass
            )}
            decoding="async"
            placeholder="blur"
            blurDataURL={resolveImagePlaceholder({
              dominantColor: heroImage.meta?.dominantColor ?? null,
              blurhash: heroImage.meta?.blurhash ?? null,
              imageUrl: heroImage.url,
            }).blurDataURL}
            unoptimized={bypassOptimizer}
            loader={bypassOptimizer ? directImageLoader : undefined}
            onLoad={() => {
              if (!heroImage.url) return;
              setLoadedHeroUrl(heroImage.url);
              setFailedHeroUrl((current) => (current === heroImage.url ? null : current));
            }}
            onError={() => {
              if (!heroImage.url) return;
              setFailedHeroUrl(heroImage.url);
            }}
          />
        ) : null}
        {heroImage.url ? (
          <span className="sr-only" data-testid="explore-v2-hero-has-image">
            Hero image available
          </span>
        ) : null}
        {heroRenderState.showUnavailableBadge ? (
          <span
            className="absolute right-3 top-3 rounded-full bg-slate-900/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white"
            data-testid="explore-v2-hero-image-unavailable"
          >
            Image unavailable
          </span>
        ) : null}
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
