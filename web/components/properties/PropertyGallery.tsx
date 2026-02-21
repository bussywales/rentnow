"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import type { PropertyImage } from "@/lib/types";
import { shouldRenderDemoWatermark } from "@/lib/properties/demo";
import { shouldRenderImageCountBadge } from "@/components/properties/PropertyImageCarousel";
import { cn } from "@/components/ui/cn";
import {
  PropertyImageCarousel,
  type PropertyImageCarouselController,
} from "@/components/properties/PropertyImageCarousel";

type Props = {
  images: PropertyImage[];
  title: string;
  isDemo?: boolean;
};

const fallbackImage =
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80";
const blurDataURL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

export function PropertyGallery({ images, title, isDemo = false }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [carouselController, setCarouselController] =
    useState<PropertyImageCarouselController | null>(null);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const safeImages = useMemo(() => (images.length ? images : []), [images]);

  const imageKey = (img: PropertyImage, idx: number) => img.id || `${img.image_url}-${idx}`;
  const resolveSrc = (img: PropertyImage, idx: number) =>
    broken.has(imageKey(img, idx)) ? fallbackImage : img.image_url;
  const markBroken = (img: PropertyImage, idx: number) => {
    const key = imageKey(img, idx);
    setBroken((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const activeIndex = resolveThumbnailTargetIndex(selectedIndex, safeImages.length);

  useEffect(() => {
    const activeThumb = thumbRefs.current[activeIndex];
    activeThumb?.scrollIntoView({
      block: "nearest",
      inline: "center",
    });
  }, [activeIndex]);

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      carouselController?.scrollPrev();
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      carouselController?.scrollNext();
    }
  };

  if (!safeImages.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-600">
        <p className="text-base font-semibold text-slate-900">No photos available</p>
        <p className="mt-1 text-sm text-slate-600">
          This listing doesn&apos;t have images yet. Check back soon.
        </p>
      </div>
    );
  }

  const showNav = shouldRenderGalleryControls(safeImages.length);
  const showDemoWatermark = shouldRenderDemoWatermark({ isDemo, enabled: true });

  return (
    <div className="space-y-3 min-w-0 max-w-full">
      <div
        className="group/property-gallery relative h-72 w-full max-w-full overflow-hidden rounded-2xl bg-slate-100"
        tabIndex={0}
        onKeyDown={handleKey}
        aria-label="Property photos"
      >
        <PropertyImageCarousel
          title={title}
          images={safeImages}
          fallbackImage={fallbackImage}
          blurDataURL={blurDataURL}
          sizes="(max-width: 768px) 100vw, 640px"
          className="h-full"
          rootTestId="property-detail-gallery-carousel"
          enableActiveSlideMotion
          onSelectedIndexChange={setSelectedIndex}
          onCarouselReady={setCarouselController}
          countBadgeClassName="top-3"
        />
        {showDemoWatermark && (
          <div
            className="property-demo-watermark pointer-events-none absolute inset-0 z-[2] flex items-center justify-center text-5xl font-black uppercase tracking-[0.5em] text-white/25"
            aria-hidden
          >
            Demo
          </div>
        )}
      </div>
      {showNav && (
        <div className="relative">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-6 bg-gradient-to-r from-white via-white/70 to-transparent"
            aria-hidden
            data-testid="property-gallery-thumbnail-fade-left"
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-6 bg-gradient-to-l from-white via-white/70 to-transparent"
            aria-hidden
            data-testid="property-gallery-thumbnail-fade-right"
          />
          <div className="flex w-full max-w-full min-w-0 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {safeImages.map((img, idx) => (
              <button
                key={img.id || idx}
                ref={(node) => {
                  thumbRefs.current[idx] = node;
                }}
                type="button"
                onClick={() => {
                  const targetIndex = resolveThumbnailTargetIndex(idx, safeImages.length);
                  setSelectedIndex(targetIndex);
                  carouselController?.scrollTo(targetIndex);
                }}
                className={cn(
                  "relative h-16 w-24 flex-none overflow-hidden rounded-lg border transition",
                  idx === activeIndex
                    ? "border-sky-500 ring-2 ring-sky-200"
                    : "border-slate-200 hover:border-slate-300"
                )}
                data-testid="property-gallery-thumbnail"
                data-active={idx === activeIndex ? "true" : "false"}
                aria-label={`Photo ${idx + 1}`}
              >
                <Image
                  src={resolveSrc(img, idx)}
                  alt={`${title} thumbnail ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="96px"
                  placeholder="blur"
                  blurDataURL={blurDataURL}
                  onError={() => markBroken(img, idx)}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function shouldRenderGalleryControls(totalImages: number): boolean {
  return shouldRenderImageCountBadge(totalImages);
}

export function shouldRenderGalleryThumbnails(totalImages: number): boolean {
  return shouldRenderGalleryControls(totalImages);
}

export function resolveThumbnailTargetIndex(index: number, totalImages: number): number {
  if (totalImages <= 0) return 0;
  if (index < 0) return 0;
  if (index >= totalImages) return totalImages - 1;
  return index;
}
