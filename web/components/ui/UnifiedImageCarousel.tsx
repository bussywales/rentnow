"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/components/ui/cn";

export type UnifiedImageCarouselItem = {
  id?: string;
  src: string;
  alt: string;
};

export type UnifiedImageCarouselController = {
  scrollTo: (index: number) => void;
  scrollPrev: () => void;
  scrollNext: () => void;
};

type Props = {
  items: UnifiedImageCarouselItem[];
  href?: string;
  fallbackImage: string;
  sizes: string;
  className?: string;
  imageClassName?: string;
  slideClassName?: string;
  countBadgeClassName?: string;
  showCountBadge?: boolean;
  showArrows?: boolean;
  showDots?: boolean;
  enableActiveSlideMotion?: boolean;
  rootTestId?: string;
  dotsTestId?: string;
  blurDataURL?: string;
  prioritizeFirstImage?: boolean;
  onSelectedIndexChange?: (index: number) => void;
  onCarouselReady?: (controller: UnifiedImageCarouselController | null) => void;
};

const BLUR_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const DRAG_NAVIGATION_THRESHOLD_PX = 8;
const TRACKPAD_SCROLL_THROTTLE_MS = 160;
const HORIZONTAL_WHEEL_THRESHOLD_PX = 6;
const HORIZONTAL_VS_VERTICAL_RATIO = 1.2;
const WHEEL_GESTURE_IDLE_RESET_MS = 220;

export function shouldRenderUnifiedImageCarouselControls(totalImages: number): boolean {
  return totalImages > 1;
}

export function shouldRenderUnifiedImageCarouselCountBadge(totalImages: number): boolean {
  return shouldRenderUnifiedImageCarouselControls(totalImages);
}

export function shouldRenderUnifiedImageCarouselDots(totalImages: number): boolean {
  return totalImages > 3;
}

export function shouldSuppressCarouselClickAfterDrag(pointerDistancePx: number): boolean {
  return pointerDistancePx > DRAG_NAVIGATION_THRESHOLD_PX;
}

export function resolveCarouselWheelDelta(input: {
  deltaX: number;
  deltaY: number;
  shiftKey?: boolean;
}): number {
  const horizontalFromTrackpad = Number.isFinite(input.deltaX) ? input.deltaX : 0;
  const horizontalFromShiftScroll =
    input.shiftKey && Number.isFinite(input.deltaY) ? input.deltaY : 0;

  if (Math.abs(horizontalFromShiftScroll) > Math.abs(horizontalFromTrackpad)) {
    return horizontalFromShiftScroll;
  }

  return horizontalFromTrackpad;
}

export function shouldHandleCarouselWheelGesture(input: {
  deltaX: number;
  deltaY: number;
  shiftKey?: boolean;
}): boolean {
  const horizontalDelta = resolveCarouselWheelDelta(input);
  const horizontalMagnitude = Math.abs(horizontalDelta);
  const verticalMagnitude = Number.isFinite(input.deltaY) ? Math.abs(input.deltaY) : 0;

  if (input.shiftKey) {
    return verticalMagnitude >= HORIZONTAL_WHEEL_THRESHOLD_PX;
  }

  return (
    horizontalMagnitude >= HORIZONTAL_WHEEL_THRESHOLD_PX ||
    horizontalMagnitude >= verticalMagnitude * HORIZONTAL_VS_VERTICAL_RATIO
  );
}

export function resolveCarouselWheelDirection(input: {
  deltaX: number;
  deltaY: number;
  shiftKey?: boolean;
}): "next" | "prev" | null {
  const horizontalDelta = resolveCarouselWheelDelta(input);
  if (Math.abs(horizontalDelta) < HORIZONTAL_WHEEL_THRESHOLD_PX) return null;
  if (horizontalDelta > 0) return "next";
  if (horizontalDelta < 0) return "prev";
  return null;
}

export function shouldThrottleCarouselWheelNavigation(input: {
  nowMs: number;
  lastTriggeredAtMs: number;
  nextDirection: "next" | "prev";
  lastDirection: "next" | "prev" | null;
  throttleMs?: number;
}): boolean {
  const throttleMs = input.throttleMs ?? TRACKPAD_SCROLL_THROTTLE_MS;
  const withinCooldown = input.nowMs - input.lastTriggeredAtMs < throttleMs;
  if (!withinCooldown) return false;
  return input.nextDirection === input.lastDirection;
}

export function UnifiedImageCarousel({
  items,
  href,
  fallbackImage,
  sizes,
  className,
  imageClassName,
  slideClassName,
  countBadgeClassName,
  showCountBadge,
  showArrows,
  showDots,
  enableActiveSlideMotion = false,
  rootTestId = "unified-image-carousel",
  dotsTestId = "unified-image-carousel-dots",
  blurDataURL = BLUR_DATA_URL,
  prioritizeFirstImage = false,
  onSelectedIndexChange,
  onCarouselReady,
}: Props) {
  const [failedImageUrls, setFailedImageUrls] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const wheelThrottleRef = useRef(0);
  const wheelDirectionRef = useRef<"next" | "prev" | null>(null);
  const wheelAccumulatorRef = useRef(0);
  const wheelLastEventAtRef = useRef(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    dragFree: false,
  });

  const controller = useMemo<UnifiedImageCarouselController | null>(() => {
    if (!emblaApi) return null;
    return {
      scrollTo: (index: number) => emblaApi.scrollTo(index),
      scrollPrev: () => emblaApi.scrollPrev(),
      scrollNext: () => emblaApi.scrollNext(),
    };
  }, [emblaApi]);

  const normalizedItems = useMemo(() => {
    if (items.length > 0) return items;
    return [
      {
        id: "fallback-image",
        src: fallbackImage,
        alt: "Listing image",
      },
    ] satisfies UnifiedImageCarouselItem[];
  }, [fallbackImage, items]);

  const failedSet = useMemo(() => new Set(failedImageUrls), [failedImageUrls]);
  const imageItems = useMemo(
    () =>
      normalizedItems.map((item) => ({
        ...item,
        src: failedSet.has(item.src) ? fallbackImage : item.src,
      })),
    [fallbackImage, failedSet, normalizedItems]
  );

  const totalImages = imageItems.length;
  const shouldShowControls = shouldRenderUnifiedImageCarouselControls(totalImages);
  const shouldShowArrows = showArrows ?? shouldShowControls;
  const shouldShowCountBadge = showCountBadge ?? shouldRenderUnifiedImageCarouselCountBadge(totalImages);
  const shouldShowDots = showDots ?? shouldRenderUnifiedImageCarouselDots(totalImages);
  const shouldAnimateSlides = enableActiveSlideMotion && shouldShowControls;
  const countIndex = Math.min(selectedIndex + 1, totalImages);
  const canScrollPrev = selectedIndex > 0;
  const canScrollNext = selectedIndex < totalImages - 1;

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    onSelectedIndexChange?.(selectedIndex);
  }, [onSelectedIndexChange, selectedIndex]);

  useEffect(() => {
    if (!onCarouselReady) return;
    onCarouselReady(controller);
    return () => {
      onCarouselReady(null);
    };
  }, [controller, onCarouselReady]);

  const handleImageError = useCallback(
    (imageUrl: string) => {
      if (!imageUrl || imageUrl === fallbackImage) return;
      setFailedImageUrls((current) => {
        if (current.includes(imageUrl)) return current;
        return [...current, imageUrl];
      });
    },
    [fallbackImage]
  );

  const handlePointerDownCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    suppressClickRef.current = false;
  }, []);

  const handlePointerMoveCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current || suppressClickRef.current) return;
    const deltaX = event.clientX - pointerStartRef.current.x;
    const deltaY = event.clientY - pointerStartRef.current.y;
    if (shouldSuppressCarouselClickAfterDrag(Math.hypot(deltaX, deltaY))) {
      suppressClickRef.current = true;
    }
  }, []);

  const handlePointerEndCapture = useCallback(() => {
    pointerStartRef.current = null;
  }, []);

  const handleClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  }, []);

  const setViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node;
      emblaRef(node);
    },
    [emblaRef]
  );

  useEffect(() => {
    const viewportNode = viewportRef.current;
    if (!viewportNode || !shouldShowControls || !emblaApi) return;

    const handleWheel = (event: WheelEvent) => {
      if (!shouldHandleCarouselWheelGesture(event)) return;

      event.preventDefault();
      const now = Date.now();

      if (now - wheelLastEventAtRef.current > WHEEL_GESTURE_IDLE_RESET_MS) {
        wheelAccumulatorRef.current = 0;
      }
      wheelLastEventAtRef.current = now;

      wheelAccumulatorRef.current += resolveCarouselWheelDelta(event);
      const direction =
        wheelAccumulatorRef.current > HORIZONTAL_WHEEL_THRESHOLD_PX
          ? "next"
          : wheelAccumulatorRef.current < -HORIZONTAL_WHEEL_THRESHOLD_PX
            ? "prev"
            : null;
      if (!direction) return;

      if (
        shouldThrottleCarouselWheelNavigation({
          nowMs: now,
          lastTriggeredAtMs: wheelThrottleRef.current,
          nextDirection: direction,
          lastDirection: wheelDirectionRef.current,
        })
      ) {
        return;
      }
      wheelThrottleRef.current = now;
      wheelDirectionRef.current = direction;
      wheelAccumulatorRef.current = 0;
      suppressClickRef.current = true;

      if (direction === "next") {
        emblaApi.scrollNext();
      } else {
        emblaApi.scrollPrev();
      }
    };

    viewportNode.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewportNode.removeEventListener("wheel", handleWheel);
    };
  }, [emblaApi, shouldShowControls]);

  return (
    <div
      className={cn("group/unified-carousel relative h-full w-full overflow-hidden", className)}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMoveCapture={handlePointerMoveCapture}
      onPointerUpCapture={handlePointerEndCapture}
      onPointerCancelCapture={handlePointerEndCapture}
      onClickCapture={handleClickCapture}
      data-testid={rootTestId}
    >
      <div
        className={cn(
          "h-full overflow-hidden",
          shouldShowControls && "cursor-grab active:cursor-grabbing"
        )}
        ref={setViewportRef}
      >
        <div className="flex h-full touch-pan-y">
          {imageItems.map((item, index) => {
            const slideKey = item.id ?? `${item.src}-${index}`;
            const isActiveSlide = index === selectedIndex;
            const imageElement = (
              <Image
                src={item.src}
                alt={item.alt}
                fill
                className={cn("select-none object-cover", imageClassName)}
                sizes={sizes}
                priority={prioritizeFirstImage && index === 0}
                loading={prioritizeFirstImage && index === 0 ? "eager" : "lazy"}
                fetchPriority={prioritizeFirstImage && index === 0 ? "high" : "auto"}
                placeholder="blur"
                blurDataURL={blurDataURL}
                draggable={false}
                onError={() => handleImageError(item.src)}
              />
            );

            return (
              <div
                key={slideKey}
                className={cn(
                  "relative h-full min-w-0 shrink-0 grow-0 basis-full",
                  shouldAnimateSlides &&
                    "transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
                  shouldAnimateSlides && isActiveSlide && "scale-[1.005] opacity-100",
                  shouldAnimateSlides && !isActiveSlide && "scale-[0.995] opacity-95",
                  slideClassName
                )}
                data-active-slide={isActiveSlide ? "true" : "false"}
              >
                {href ? (
                  <Link href={href} className="block h-full w-full" draggable={false} aria-label={`View ${item.alt}`}>
                    {imageElement}
                  </Link>
                ) : (
                  imageElement
                )}
              </div>
            );
          })}
        </div>
      </div>

      {shouldShowCountBadge ? (
        <span
          className={cn(
            "pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-slate-900/75 px-2 py-0.5 text-[11px] font-medium text-white",
            countBadgeClassName
          )}
          data-testid={`${rootTestId}-count-badge`}
        >
          {`${countIndex}/${totalImages}`}
        </span>
      ) : null}

      {shouldShowArrows ? (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              emblaApi?.scrollPrev();
            }}
            className={cn(
              "absolute left-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/70 bg-white/90 text-slate-700 shadow-sm transition-opacity sm:flex",
              canScrollPrev
                ? "opacity-0 group-hover/unified-carousel:opacity-100"
                : "pointer-events-none opacity-0"
            )}
            data-testid={`${rootTestId}-arrow-prev`}
          >
            <span aria-hidden>&larr;</span>
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              emblaApi?.scrollNext();
            }}
            className={cn(
              "absolute right-2 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/70 bg-white/90 text-slate-700 shadow-sm transition-opacity sm:flex",
              canScrollNext
                ? "opacity-0 group-hover/unified-carousel:opacity-100"
                : "pointer-events-none opacity-0"
            )}
            data-testid={`${rootTestId}-arrow-next`}
          >
            <span aria-hidden>&rarr;</span>
          </button>
        </>
      ) : null}

      {shouldShowDots ? (
        <div
          className="absolute inset-x-0 bottom-2 z-10 flex items-center justify-center gap-1"
          data-testid={dotsTestId}
        >
          {imageItems.map((item, index) => (
            <button
              key={`dot-${item.id ?? index}`}
              type="button"
              aria-label={`View image ${index + 1}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                emblaApi?.scrollTo(index);
              }}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition",
                index === selectedIndex ? "bg-white" : "bg-white/55"
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
