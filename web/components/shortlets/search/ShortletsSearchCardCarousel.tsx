"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { resolvePropertyImageSources } from "@/components/properties/PropertyImageCarousel";
import type { PropertyImage } from "@/lib/types";
import { cn } from "@/components/ui/cn";

type Props = {
  title: string;
  href: string;
  coverImageUrl?: string | null;
  primaryImageUrl?: string | null;
  imageUrls?: string[] | null;
  images?: PropertyImage[] | null;
  fallbackImage: string;
};

const BLUR_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const DRAG_SUPPRESS_CLICK_PX = 6;

export function shouldRenderShortletsCarouselDots(totalImages: number): boolean {
  return totalImages > 3;
}

export function shouldRenderShortletsCarouselArrows(totalImages: number): boolean {
  return totalImages > 1;
}

export function resolveShortletsCarouselImageSources(input: {
  coverImageUrl?: string | null;
  primaryImageUrl?: string | null;
  imageUrls?: string[] | null;
  images?: PropertyImage[] | null;
  fallbackImage: string;
}): string[] {
  const fromUrls = (input.imageUrls ?? [])
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((imageUrl, index) => ({
      id: `search-image-${index}`,
      image_url: imageUrl,
    })) satisfies PropertyImage[];

  const mergedImages = [...(input.images ?? []), ...fromUrls];
  return resolvePropertyImageSources({
    coverImageUrl: input.coverImageUrl ?? null,
    primaryImageUrl: input.primaryImageUrl ?? null,
    images: mergedImages,
    fallbackImage: input.fallbackImage,
  });
}

export function resolveShortletsCarouselIndexFromScroll(input: {
  scrollLeft: number;
  viewportWidth: number;
  totalImages: number;
}): number {
  if (!Number.isFinite(input.viewportWidth) || input.viewportWidth <= 0) return 0;
  if (input.totalImages <= 1) return 0;
  const raw = Math.round(input.scrollLeft / input.viewportWidth);
  return Math.max(0, Math.min(input.totalImages - 1, raw));
}

export function ShortletsSearchCardCarousel({
  title,
  href,
  coverImageUrl,
  primaryImageUrl,
  imageUrls,
  images,
  fallbackImage,
}: Props) {
  const imageSources = useMemo(
    () =>
      resolveShortletsCarouselImageSources({
        coverImageUrl,
        primaryImageUrl,
        imageUrls,
        images,
        fallbackImage,
      }),
    [coverImageUrl, primaryImageUrl, imageUrls, images, fallbackImage]
  );
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartScrollLeftRef = useRef(0);
  const dragDeltaRef = useRef(0);
  const suppressClickRef = useRef(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const showDots = shouldRenderShortletsCarouselDots(imageSources.length);
  const showArrows = shouldRenderShortletsCarouselArrows(imageSources.length);
  const activeIndex = Math.max(
    0,
    Math.min(imageSources.length > 0 ? imageSources.length - 1 : 0, selectedIndex)
  );

  useEffect(() => {
    return () => {
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  const scrollToIndex = useCallback(
    (nextIndex: number, behavior: ScrollBehavior = "smooth") => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const clamped = Math.max(0, Math.min(imageSources.length - 1, nextIndex));
      viewport.scrollTo({
        left: clamped * viewport.clientWidth,
        behavior,
      });
      setSelectedIndex(clamped);
    },
    [imageSources.length]
  );

  const syncIndexFromScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextIndex = resolveShortletsCarouselIndexFromScroll({
      scrollLeft: viewport.scrollLeft,
      viewportWidth: viewport.clientWidth,
      totalImages: imageSources.length,
    });
    setSelectedIndex(nextIndex);
  }, [imageSources.length]);

  const onViewportScroll = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      syncIndexFromScroll();
    });
  }, [syncIndexFromScroll]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== "mouse" || imageSources.length <= 1) return;
      const viewport = viewportRef.current;
      if (!viewport) return;
      activePointerIdRef.current = event.pointerId;
      dragStartXRef.current = event.clientX;
      dragStartScrollLeftRef.current = viewport.scrollLeft;
      dragDeltaRef.current = 0;
      suppressClickRef.current = false;
      setDragging(true);
      viewport.setPointerCapture(event.pointerId);
    },
    [imageSources.length]
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const delta = event.clientX - dragStartXRef.current;
    dragDeltaRef.current = delta;
    if (Math.abs(delta) > DRAG_SUPPRESS_CLICK_PX) {
      suppressClickRef.current = true;
    }
    viewport.scrollLeft = dragStartScrollLeftRef.current - delta;
  }, []);

  const endPointerDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (activePointerIdRef.current !== event.pointerId) return;
      const viewport = viewportRef.current;
      if (viewport && viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
      }
      activePointerIdRef.current = null;
      setDragging(false);
      syncIndexFromScroll();
      if (Math.abs(dragDeltaRef.current) > DRAG_SUPPRESS_CLICK_PX) {
        const nextIndex = resolveShortletsCarouselIndexFromScroll({
          scrollLeft: viewport?.scrollLeft ?? 0,
          viewportWidth: viewport?.clientWidth ?? 0,
          totalImages: imageSources.length,
        });
        scrollToIndex(nextIndex);
      }
    },
    [imageSources.length, scrollToIndex, syncIndexFromScroll]
  );

  const onSlideClickCapture = useCallback((event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  }, []);

  return (
    <div
      className="group relative h-44 w-full overflow-hidden bg-slate-100 sm:h-48"
      data-testid="shortlets-search-card-carousel"
    >
      <div
        ref={viewportRef}
        className={cn(
          "flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth touch-pan-y",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          dragging ? "cursor-grabbing" : "cursor-grab"
        )}
        style={{ WebkitOverflowScrolling: "touch" }}
        onScroll={onViewportScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointerDrag}
        onPointerCancel={endPointerDrag}
      >
        {imageSources.map((source, index) => (
          <Link
            key={`shortlets-search-slide-${index}`}
            href={href}
            className="relative block h-full w-full shrink-0 snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            onClickCapture={onSlideClickCapture}
          >
            <Image
              src={source}
              alt={title}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, (max-width: 1400px) 48vw, 33vw"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              priority={index === 0}
            />
          </Link>
        ))}
      </div>
      {showArrows ? (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 group-hover:inline-flex"
            onClick={() => scrollToIndex(activeIndex - 1)}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next photo"
            className="absolute right-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 group-hover:inline-flex"
            onClick={() => scrollToIndex(activeIndex + 1)}
          >
            ›
          </button>
        </>
      ) : null}
      {showDots ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex items-center justify-center gap-1"
          data-testid="shortlets-search-card-carousel-dots"
        >
          {imageSources.map((_, index) => (
            <button
              key={`shortlets-carousel-dot-${index}`}
              type="button"
              className={`h-1.5 w-1.5 rounded-full ${
                index === activeIndex ? "bg-white" : "bg-white/55"
              }`}
              aria-label={`View photo ${index + 1}`}
              onClick={() => scrollToIndex(index)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
