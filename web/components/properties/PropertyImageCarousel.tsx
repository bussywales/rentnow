"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { orderImagesWithCover } from "@/lib/properties/images";
import type { PropertyImage } from "@/lib/types";

type Props = {
  title: string;
  href?: string;
  coverImageUrl?: string | null;
  primaryImageUrl?: string | null;
  images?: PropertyImage[];
  fallbackImage: string;
  blurDataURL: string;
  sizes: string;
  className?: string;
  imageClassName?: string;
  countBadgeClassName?: string;
  onSelectedIndexChange?: (index: number) => void;
  onCarouselReady?: (controller: PropertyImageCarouselController | null) => void;
};

export type PropertyImageCarouselController = {
  scrollTo: (index: number) => void;
  scrollPrev: () => void;
  scrollNext: () => void;
};

const DRAG_NAVIGATION_THRESHOLD_PX = 8;

function resolveImageSources({
  coverImageUrl,
  images,
  primaryImageUrl,
  fallbackImage,
}: {
  coverImageUrl?: string | null;
  images?: PropertyImage[];
  primaryImageUrl?: string | null;
  fallbackImage: string;
}): string[] {
  const ordered = orderImagesWithCover(coverImageUrl, images ?? []);
  const orderedUrls = ordered
    .map((image) => image.image_url)
    .filter((imageUrl): imageUrl is string => typeof imageUrl === "string" && imageUrl.length > 0);
  const seededUrls = [primaryImageUrl, ...orderedUrls].filter(
    (imageUrl): imageUrl is string => typeof imageUrl === "string" && imageUrl.length > 0
  );
  const deduped = Array.from(new Set(seededUrls));
  return deduped.length > 0 ? deduped : [fallbackImage];
}

export function shouldRenderImageCountBadge(totalImages: number): boolean {
  return totalImages > 1;
}

export function PropertyImageCarousel({
  title,
  href,
  coverImageUrl,
  primaryImageUrl,
  images,
  fallbackImage,
  blurDataURL,
  sizes,
  className,
  imageClassName,
  countBadgeClassName,
  onSelectedIndexChange,
  onCarouselReady,
}: Props) {
  const computedSources = useMemo(
    () =>
      resolveImageSources({
        coverImageUrl,
        images,
        primaryImageUrl,
        fallbackImage,
      }),
    [coverImageUrl, images, primaryImageUrl, fallbackImage]
  );
  const [failedImageUrls, setFailedImageUrls] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const failedImageUrlSet = useMemo(() => new Set(failedImageUrls), [failedImageUrls]);
  const imageSources = useMemo(
    () =>
      computedSources.map((imageUrl) =>
        failedImageUrlSet.has(imageUrl) ? fallbackImage : imageUrl
      ),
    [computedSources, failedImageUrlSet, fallbackImage]
  );
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    dragFree: false,
  });
  const controller = useMemo<PropertyImageCarouselController | null>(() => {
    if (!emblaApi) {
      return null;
    }

    return {
      scrollTo: (index: number) => emblaApi.scrollTo(index),
      scrollPrev: () => emblaApi.scrollPrev(),
      scrollNext: () => emblaApi.scrollNext(),
    };
  }, [emblaApi]);

  const updateCarouselState = useCallback(() => {
    if (!emblaApi) {
      return;
    }

    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) {
      return;
    }

    emblaApi.on("select", updateCarouselState);
    emblaApi.on("reInit", updateCarouselState);

    return () => {
      emblaApi.off("select", updateCarouselState);
      emblaApi.off("reInit", updateCarouselState);
    };
  }, [emblaApi, updateCarouselState]);

  useEffect(() => {
    onSelectedIndexChange?.(selectedIndex);
  }, [onSelectedIndexChange, selectedIndex]);

  useEffect(() => {
    if (!onCarouselReady) {
      return;
    }
    onCarouselReady(controller);
    return () => {
      onCarouselReady(null);
    };
  }, [controller, onCarouselReady]);

  const handleImageError = useCallback(
    (imageUrl: string) => {
      if (!imageUrl || imageUrl === fallbackImage) {
        return;
      }
      setFailedImageUrls((currentUrls) => {
        if (currentUrls.includes(imageUrl)) {
          return currentUrls;
        }
        return [...currentUrls, imageUrl];
      });
    },
    [fallbackImage]
  );

  const handlePointerDownCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    suppressClickRef.current = false;
  }, []);

  const handlePointerMoveCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current || suppressClickRef.current) {
      return;
    }
    const deltaX = event.clientX - pointerStartRef.current.x;
    const deltaY = event.clientY - pointerStartRef.current.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance > DRAG_NAVIGATION_THRESHOLD_PX) {
      suppressClickRef.current = true;
    }
  }, []);

  const handlePointerEndCapture = useCallback(() => {
    pointerStartRef.current = null;
  }, []);

  const handleClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  }, []);

  const showCountBadge = shouldRenderImageCountBadge(imageSources.length);
  const canScrollPrev = selectedIndex > 0;
  const canScrollNext = selectedIndex < imageSources.length - 1;
  const countIndex = Math.min(selectedIndex + 1, imageSources.length);

  return (
    <div
      className={cn("group/property-carousel relative h-full w-full overflow-hidden", className)}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMoveCapture={handlePointerMoveCapture}
      onPointerUpCapture={handlePointerEndCapture}
      onPointerCancelCapture={handlePointerEndCapture}
      onClickCapture={handleClickCapture}
      data-testid="property-image-carousel"
    >
      <div className="h-full overflow-hidden" ref={emblaRef}>
        <div className="flex h-full touch-pan-y">
          {imageSources.map((imageUrl, index) => (
            <div
              key={`${imageUrl}-${index}`}
              className="relative h-full min-w-0 shrink-0 grow-0 basis-full"
            >
              {href ? (
                <Link
                  href={href}
                  aria-label={`View ${title}`}
                  className="block h-full w-full"
                  draggable={false}
                >
                  <Image
                    src={imageUrl}
                    alt={title}
                    fill
                    className={cn("select-none object-cover", imageClassName)}
                    sizes={sizes}
                    priority={false}
                    placeholder="blur"
                    blurDataURL={blurDataURL}
                    draggable={false}
                    onError={() => handleImageError(imageUrl)}
                  />
                </Link>
              ) : (
                <Image
                  src={imageUrl}
                  alt={title}
                  fill
                  className={cn("select-none object-cover", imageClassName)}
                  sizes={sizes}
                  priority={false}
                  placeholder="blur"
                  blurDataURL={blurDataURL}
                  draggable={false}
                  onError={() => handleImageError(imageUrl)}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {showCountBadge && (
        <span
          className={cn(
            "pointer-events-none absolute right-3 top-14 z-10 rounded-full bg-slate-900/75 px-2 py-0.5 text-[11px] font-medium text-white",
            countBadgeClassName
          )}
          data-testid="property-image-count-badge"
        >
          {`${countIndex}/${imageSources.length}`}
        </span>
      )}

      {showCountBadge && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            className={cn(
              "absolute left-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/70 bg-white/90 text-slate-700 shadow-sm transition-opacity sm:flex",
              canScrollPrev
                ? "opacity-0 group-hover/property-carousel:opacity-100"
                : "pointer-events-none opacity-0"
            )}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              emblaApi?.scrollPrev();
            }}
          >
            <span aria-hidden>&larr;</span>
          </button>
          <button
            type="button"
            aria-label="Next image"
            className={cn(
              "absolute right-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/70 bg-white/90 text-slate-700 shadow-sm transition-opacity sm:flex",
              canScrollNext
                ? "opacity-0 group-hover/property-carousel:opacity-100"
                : "pointer-events-none opacity-0"
            )}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              emblaApi?.scrollNext();
            }}
          >
            <span aria-hidden>&rarr;</span>
          </button>
        </>
      )}
    </div>
  );
}
