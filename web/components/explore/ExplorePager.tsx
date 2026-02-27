"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { resolvePropertyImageSources } from "@/components/properties/PropertyImageCarousel";
import type { Property } from "@/lib/types";
import { getPrimaryImageUrl } from "@/lib/properties/images";
import { ExploreSlide } from "@/components/explore/ExploreSlide";

type ExplorePagerProps = {
  listings: Property[];
};

const EXPLORE_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80";

function resolveExploreHeroImageUrl(property: Property): string {
  const imageSources = resolvePropertyImageSources({
    coverImageUrl: property.cover_image_url,
    images: property.images,
    primaryImageUrl: getPrimaryImageUrl(property),
    fallbackImage: EXPLORE_FALLBACK_IMAGE,
  });
  return imageSources[0] ?? EXPLORE_FALLBACK_IMAGE;
}

export function resolveExploreActiveSlideIndex(
  scrollTop: number,
  viewportHeight: number,
  totalSlides: number
): number {
  if (totalSlides <= 1) return 0;
  const safeViewportHeight = Math.max(1, viewportHeight);
  const boundedIndex = Math.round(scrollTop / safeViewportHeight);
  return Math.min(totalSlides - 1, Math.max(0, boundedIndex));
}

export function resolveExploreAdjacentSlideIndexes(activeIndex: number, totalSlides: number): number[] {
  const indexes = [activeIndex + 1, activeIndex - 1];
  return indexes.filter((index) => index >= 0 && index < totalSlides);
}

export function shouldPreloadExploreSlideImages(saveData: boolean | undefined): boolean {
  return !saveData;
}

export function ExplorePager({ listings }: ExplorePagerProps) {
  const pagerRef = useRef<HTMLDivElement | null>(null);
  const preloadedImagesRef = useRef<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const [verticalScrollLocked, setVerticalScrollLocked] = useState(false);
  const heroImageUrls = useMemo(() => listings.map((property) => resolveExploreHeroImageUrl(property)), [listings]);
  const displayedIndex = Math.min(activeIndex, Math.max(0, listings.length - 1));

  useEffect(() => {
    const pager = pagerRef.current;
    if (!pager) return;

    let rafId = 0;
    const syncActiveSlide = () => {
      const nextIndex = resolveExploreActiveSlideIndex(pager.scrollTop, pager.clientHeight, listings.length);
      setActiveIndex((current) => (current === nextIndex ? current : nextIndex));
    };

    syncActiveSlide();
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(syncActiveSlide);
    };
    pager.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", syncActiveSlide);

    return () => {
      cancelAnimationFrame(rafId);
      pager.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", syncActiveSlide);
    };
  }, [listings.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (!shouldPreloadExploreSlideImages(connection?.saveData)) return;

    for (const index of resolveExploreAdjacentSlideIndexes(displayedIndex, listings.length)) {
      const imageUrl = heroImageUrls[index];
      if (!imageUrl || preloadedImagesRef.current.has(imageUrl)) continue;
      const image = new Image();
      image.decoding = "async";
      image.src = imageUrl;
      preloadedImagesRef.current.add(imageUrl);
    }
  }, [displayedIndex, heroImageUrls, listings.length]);

  if (!listings.length) {
    return (
      <section
        className="mx-auto flex min-h-[60svh] max-w-lg flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm"
        data-testid="explore-empty"
      >
        <h1 className="text-xl font-semibold text-slate-900">Explore listings</h1>
        <p className="text-sm text-slate-600">
          We could not load the explore feed right now. Try browsing shortlets or properties.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/shortlets"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Browse shortlets
          </Link>
          <Link
            href="/properties"
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Browse properties
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 shadow-sm"
      data-testid="explore-root"
    >
      {listings.length > 1 ? (
        <p
          className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-white/25 bg-slate-950/55 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur"
          data-testid="explore-progress"
          aria-live="polite"
        >
          {`${displayedIndex + 1} / ${listings.length}`}
        </p>
      ) : null}
      <div
        className="scrollbar-none h-[100svh] snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
        data-testid="explore-pager"
        ref={pagerRef}
        style={{ overflowY: verticalScrollLocked ? "hidden" : "auto" }}
      >
        {listings.map((property, index) => (
          <ExploreSlide
            key={property.id}
            property={property}
            index={index}
            onGestureLockChange={setVerticalScrollLocked}
          />
        ))}
      </div>
    </section>
  );
}
