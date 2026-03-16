"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import type { ImageLoader } from "next/image";
import Link from "next/link";
import { useImageOptimizationMode } from "@/components/layout/ImageOptimizationModeProvider";
import { cn } from "@/components/ui/cn";
import {
  accumulateWheelDelta,
  applyInertialSnapHint,
  resolveWheelDelta,
  resolveWheelDirectionFromAccumulatedDelta,
  shouldSuppressCarouselClickAfterDrag,
  shouldThrottleWheelNavigation,
  shouldTreatWheelAsHorizontal,
  WHEEL_GESTURE_IDLE_RESET_MS,
} from "@/lib/ui/carousel-interactions";
import { resolveImageLoadingProfile } from "@/lib/images/loading-profile";
import { shouldBypassNextImageOptimizer } from "@/lib/images/optimizer-bypass";
import { shouldDisableImageOptimizationForUsage } from "@/lib/media/image-optimization-mode";
import {
  normalizeHexColor,
  resolveImagePlaceholder,
  type PlaceholderSource,
} from "@/lib/images/placeholders";
import { useDebouncedVisibility } from "@/lib/ui/useDebouncedVisibility";

export type UnifiedImageCarouselItem = {
  id?: string;
  src: string;
  alt: string;
  placeholderColor?: string | null;
  placeholderBlurDataURL?: string | null;
  placeholderSource?: PlaceholderSource;
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
  dotsClassName?: string;
  blurDataURL?: string;
  prioritizeFirstImage?: boolean;
  renderWindowRadius?: number;
  progressiveUpgradeOnIdle?: boolean;
  maxConcurrentImageLoads?: number;
  showLoadingCue?: boolean;
  onSelectedIndexChange?: (index: number) => void;
  onCarouselReady?: (controller: UnifiedImageCarouselController | null) => void;
  onImageError?: (payload: { imageUrl: string; index: number }) => void;
};

const BLUR_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const directImageLoader: ImageLoader = ({ src }) => src;
const UNIFIED_CAROUSEL_DEFAULT_MAX_CONCURRENT_IMAGE_LOADS = 3;
const UNIFIED_CAROUSEL_PROGRESSIVE_IDLE_DELAY_MS = 260;
export const UNIFIED_CAROUSEL_LOADING_CUE_SHOW_AFTER_MS = 300;
export const UNIFIED_CAROUSEL_LOADING_CUE_MIN_VISIBLE_MS = 600;
export const UNIFIED_CAROUSEL_MIN_PLACEHOLDER_VISIBLE_MS = 160;
export const UNIFIED_CAROUSEL_PREMIUM_NEUTRAL_SLIDE_BACKGROUND_CLASS =
  "bg-slate-950/10 dark:bg-slate-100/10";

type UnifiedIdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;
type UnifiedIdleWindow = Window & {
  requestIdleCallback?: (callback: UnifiedIdleCallback, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

type UnifiedImagePlaceholderHoldInput = {
  startedAtMs: number;
  minVisibleMs: number;
  nowMs?: number;
};

type UnifiedImageRevealGateInput = {
  startedAtMs: number;
  minVisibleMs?: number;
  decode?: (() => Promise<void>) | null;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};
export {
  shouldSuppressCarouselClickAfterDrag,
  resolveWheelDelta as resolveCarouselWheelDelta,
  shouldTreatWheelAsHorizontal as shouldHandleCarouselWheelGesture,
  resolveWheelDirection as resolveCarouselWheelDirection,
  shouldThrottleWheelNavigation as shouldThrottleCarouselWheelNavigation,
} from "@/lib/ui/carousel-interactions";

export function shouldRenderUnifiedImageCarouselControls(totalImages: number): boolean {
  return totalImages > 1;
}

export function shouldRenderUnifiedImageCarouselCountBadge(totalImages: number): boolean {
  return shouldRenderUnifiedImageCarouselControls(totalImages);
}

export function shouldRenderUnifiedImageCarouselDots(totalImages: number): boolean {
  return totalImages > 3;
}

export function resolveUnifiedImageCarouselMaxConcurrentImageLoads(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return UNIFIED_CAROUSEL_DEFAULT_MAX_CONCURRENT_IMAGE_LOADS;
  return Math.max(1, Math.trunc(limit as number));
}

export function resolveUnifiedImageCarouselLoadCandidates(input: {
  totalImages: number;
  selectedIndex: number;
  windowRadius: number | undefined;
  loadedIndexes: Set<number>;
  maxConcurrentImageLoads: number;
}): Set<number> {
  const total = Math.max(0, input.totalImages);
  const radius = typeof input.windowRadius === "number" ? Math.max(0, Math.trunc(input.windowRadius)) : Number.POSITIVE_INFINITY;
  const selected = Math.max(0, Math.min(total - 1, input.selectedIndex));
  const maxConcurrent = resolveUnifiedImageCarouselMaxConcurrentImageLoads(input.maxConcurrentImageLoads);
  const renderableIndexes: number[] = [];
  for (let index = 0; index < total; index += 1) {
    if (Math.abs(index - selected) <= radius) {
      renderableIndexes.push(index);
    }
  }
  const loadedRenderable = renderableIndexes.filter((index) => input.loadedIndexes.has(index));
  const pendingRenderable = renderableIndexes
    .filter((index) => !input.loadedIndexes.has(index))
    .sort((a, b) => Math.abs(a - selected) - Math.abs(b - selected));
  const mounted = new Set<number>(loadedRenderable);
  pendingRenderable.slice(0, maxConcurrent).forEach((index) => {
    mounted.add(index);
  });
  return mounted;
}

export function resolveUnifiedImageCarouselGestureRetainedIndexes(input: {
  totalImages: number;
  selectedIndex: number;
  gestureStartIndex: number | null;
  isDragging: boolean;
  isInMotion: boolean;
}): Set<number> {
  if (!input.isDragging && !input.isInMotion) {
    return new Set<number>();
  }

  const retained = new Set<number>();
  const total = Math.max(0, input.totalImages);
  const addIndex = (index: number | null | undefined) => {
    if (!Number.isInteger(index)) return;
    const value = index as number;
    if (value < 0 || value >= total) return;
    retained.add(value);
  };

  addIndex(input.selectedIndex);
  addIndex(input.selectedIndex - 1);
  addIndex(input.selectedIndex + 1);
  addIndex(input.gestureStartIndex);
  if (input.gestureStartIndex !== null) {
    addIndex(input.gestureStartIndex - 1);
    addIndex(input.gestureStartIndex + 1);
  }
  return retained;
}

export function resolveUnifiedImagePlaceholderPresentation(input: {
  item: UnifiedImageCarouselItem;
  fallbackBlurDataURL: string;
}): {
  dominantColor: string;
  blurDataURL: string;
  source: PlaceholderSource;
  style: {
    backgroundColor: string;
    backgroundImage: string;
    backgroundSize: string;
    backgroundPosition: string;
  };
} {
  const itemDominantColor = normalizeHexColor(input.item.placeholderColor) ?? input.item.placeholderColor ?? null;
  const resolvedPlaceholder = resolveImagePlaceholder({
    dominantColor: itemDominantColor,
    imageUrl: input.item.src,
  });
  const blurDataURL = input.item.placeholderBlurDataURL || resolvedPlaceholder.blurDataURL || input.fallbackBlurDataURL;
  const source = input.item.placeholderSource ?? resolvedPlaceholder.source;
  return {
    dominantColor: resolvedPlaceholder.dominantColor,
    blurDataURL,
    source,
    style: {
      backgroundColor: resolvedPlaceholder.dominantColor,
      backgroundImage: `url("${blurDataURL}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
  };
}

export function resolveUnifiedImagePlaceholderHoldMs(input: UnifiedImagePlaceholderHoldInput): number {
  const nowMs = Number.isFinite(input.nowMs) ? (input.nowMs as number) : Date.now();
  const elapsedMs = Math.max(0, nowMs - input.startedAtMs);
  return Math.max(0, input.minVisibleMs - elapsedMs);
}

export async function waitForUnifiedImageRevealGate(input: UnifiedImageRevealGateInput): Promise<void> {
  const decode = input.decode ?? null;
  if (decode) {
    try {
      await decode();
    } catch {
      // Decode failure should not block visibility forever.
    }
  }
  const holdMs = resolveUnifiedImagePlaceholderHoldMs({
    startedAtMs: input.startedAtMs,
    minVisibleMs: input.minVisibleMs ?? UNIFIED_CAROUSEL_MIN_PLACEHOLDER_VISIBLE_MS,
    nowMs: input.now?.(),
  });
  if (holdMs <= 0) return;
  const sleep =
    input.sleep ??
    ((ms: number) =>
      new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, ms);
      }));
  await sleep(holdMs);
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
  dotsClassName,
  blurDataURL = BLUR_DATA_URL,
  prioritizeFirstImage = false,
  renderWindowRadius,
  progressiveUpgradeOnIdle = false,
  maxConcurrentImageLoads,
  showLoadingCue = false,
  onSelectedIndexChange,
  onCarouselReady,
  onImageError,
}: Props) {
  const optimizationMode = useImageOptimizationMode();
  const inputTotalImages = items.length > 0 ? items.length : 1;
  const allowDrag = inputTotalImages > 1;
  const [failedImageUrls, setFailedImageUrls] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadedImageKeys, setLoadedImageKeys] = useState<Set<string>>(new Set());
  const [revealedImageKeys, setRevealedImageKeys] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [isInMotion, setIsInMotion] = useState(false);
  const [gestureStartIndex, setGestureStartIndex] = useState<number | null>(null);
  const [idleReadyKey, setIdleReadyKey] = useState<string | null>(
    progressiveUpgradeOnIdle ? null : "ready"
  );
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const wheelThrottleRef = useRef(0);
  const wheelDirectionRef = useRef<"next" | "prev" | null>(null);
  const wheelAccumulatorRef = useRef(0);
  const wheelLastEventAtRef = useRef(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imageLoadStartedAtRef = useRef<Map<string, number>>(new Map());
  const componentMountedRef = useRef(true);
  const motionIdleTimeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    dragFree: false,
    watchDrag: allowDrag,
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
  const boundedSelectedIndex = Math.max(0, Math.min(totalImages - 1, selectedIndex));
  const progressiveCycleKey = `${boundedSelectedIndex}:${totalImages}:${renderWindowRadius ?? "full"}`;
  const idleProgressiveReady = !progressiveUpgradeOnIdle || idleReadyKey === progressiveCycleKey;
  const effectiveRenderWindowRadius =
    typeof renderWindowRadius === "number"
      ? Math.max(0, renderWindowRadius - (idleProgressiveReady ? 0 : 1))
      : renderWindowRadius;
  const effectiveMaxConcurrentImageLoads = resolveUnifiedImageCarouselMaxConcurrentImageLoads(
    maxConcurrentImageLoads
  );
  const loadedIndexes = useMemo(() => {
    const next = new Set<number>();
    imageItems.forEach((item, index) => {
      const loadKey = `${item.id ?? index}:${item.src}`;
      if (loadedImageKeys.has(loadKey)) {
        next.add(index);
      }
    });
    return next;
  }, [imageItems, loadedImageKeys]);
  const gestureRetainedIndexes = useMemo(
    () =>
      resolveUnifiedImageCarouselGestureRetainedIndexes({
        totalImages,
        selectedIndex: boundedSelectedIndex,
        gestureStartIndex,
        isDragging,
        isInMotion,
      }),
    [boundedSelectedIndex, gestureStartIndex, isDragging, isInMotion, totalImages]
  );
  const mountedImageIndexes = useMemo(
    () => {
      const mounted = resolveUnifiedImageCarouselLoadCandidates({
        totalImages,
        selectedIndex: boundedSelectedIndex,
        windowRadius: effectiveRenderWindowRadius,
        loadedIndexes,
        maxConcurrentImageLoads: effectiveMaxConcurrentImageLoads,
      });
      gestureRetainedIndexes.forEach((index) => {
        mounted.add(index);
      });
      return mounted;
    },
    [
      boundedSelectedIndex,
      effectiveMaxConcurrentImageLoads,
      effectiveRenderWindowRadius,
      gestureRetainedIndexes,
      loadedIndexes,
      totalImages,
    ]
  );
  const activeImageLoadKey = useMemo(() => {
    if (!imageItems[boundedSelectedIndex]) return null;
    const activeItem = imageItems[boundedSelectedIndex];
    return `${activeItem.id ?? boundedSelectedIndex}:${activeItem.src}`;
  }, [boundedSelectedIndex, imageItems]);
  const activeImageLoaded = activeImageLoadKey ? revealedImageKeys.has(activeImageLoadKey) : false;
  const shouldShowDebouncedLoadingCue = useDebouncedVisibility(showLoadingCue && !activeImageLoaded, {
    showAfterMs: UNIFIED_CAROUSEL_LOADING_CUE_SHOW_AFTER_MS,
    minVisibleMs: UNIFIED_CAROUSEL_LOADING_CUE_MIN_VISIBLE_MS,
  });
  const shouldShowControls = shouldRenderUnifiedImageCarouselControls(totalImages);
  const shouldShowArrows = showArrows ?? shouldShowControls;
  const shouldShowCountBadge = showCountBadge ?? shouldRenderUnifiedImageCarouselCountBadge(totalImages);
  const shouldShowDots = showDots ?? shouldRenderUnifiedImageCarouselDots(totalImages);
  const shouldAnimateSlides = enableActiveSlideMotion && shouldShowControls;
  const countIndex = Math.min(boundedSelectedIndex + 1, totalImages);
  const canScrollPrev = boundedSelectedIndex > 0;
  const canScrollNext = boundedSelectedIndex < totalImages - 1;

  useEffect(() => {
    componentMountedRef.current = true;
    return () => {
      componentMountedRef.current = false;
      if (motionIdleTimeoutRef.current !== null) {
        globalThis.clearTimeout(motionIdleTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    const markMotion = () => {
      setIsInMotion(true);
      if (motionIdleTimeoutRef.current !== null) {
        globalThis.clearTimeout(motionIdleTimeoutRef.current);
      }
      motionIdleTimeoutRef.current = globalThis.setTimeout(() => {
        setIsInMotion(false);
      }, 180);
    };
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    const onPointerDown = () => {
      setIsDragging(true);
      setGestureStartIndex(emblaApi.selectedScrollSnap());
      markMotion();
    };
    const onPointerUp = () => {
      setIsDragging(false);
      markMotion();
    };
    const onScroll = () => {
      markMotion();
    };
    const onSettle = () => {
      setIsDragging(false);
      setIsInMotion(false);
      setGestureStartIndex(null);
      if (motionIdleTimeoutRef.current !== null) {
        globalThis.clearTimeout(motionIdleTimeoutRef.current);
        motionIdleTimeoutRef.current = null;
      }
    };
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    emblaApi.on("pointerDown", onPointerDown);
    emblaApi.on("pointerUp", onPointerUp);
    emblaApi.on("scroll", onScroll);
    emblaApi.on("settle", onSettle);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
      emblaApi.off("pointerDown", onPointerDown);
      emblaApi.off("pointerUp", onPointerUp);
      emblaApi.off("scroll", onScroll);
      emblaApi.off("settle", onSettle);
      if (motionIdleTimeoutRef.current !== null) {
        globalThis.clearTimeout(motionIdleTimeoutRef.current);
        motionIdleTimeoutRef.current = null;
      }
    };
  }, [emblaApi]);

  useEffect(() => {
    onSelectedIndexChange?.(selectedIndex);
  }, [onSelectedIndexChange, selectedIndex]);

  useEffect(() => {
    const nowMs = Date.now();
    mountedImageIndexes.forEach((index) => {
      const item = imageItems[index];
      if (!item) return;
      const loadKey = `${item.id ?? index}:${item.src}`;
      if (imageLoadStartedAtRef.current.has(loadKey)) return;
      imageLoadStartedAtRef.current.set(loadKey, nowMs);
    });
  }, [imageItems, mountedImageIndexes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!progressiveUpgradeOnIdle || totalImages <= 1) return;
    const targetKey = progressiveCycleKey;
    const markReady = () => {
      setIdleReadyKey((current) => (current === targetKey ? current : targetKey));
    };
    const idleWindow = window as UnifiedIdleWindow;
    if (typeof idleWindow.requestIdleCallback === "function") {
      const idleId = idleWindow.requestIdleCallback(
        () => {
          markReady();
        },
        { timeout: UNIFIED_CAROUSEL_PROGRESSIVE_IDLE_DELAY_MS }
      );
      return () => {
        idleWindow.cancelIdleCallback?.(idleId);
      };
    }
    const timeoutId = window.setTimeout(markReady, UNIFIED_CAROUSEL_PROGRESSIVE_IDLE_DELAY_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [progressiveCycleKey, progressiveUpgradeOnIdle, totalImages]);

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

  const handleImageLoad = useCallback((loadKey: string, imageElement: HTMLImageElement | null) => {
    setLoadedImageKeys((current) => {
      if (current.has(loadKey)) return current;
      const next = new Set(current);
      next.add(loadKey);
      return next;
    });

    const startedAtMs = imageLoadStartedAtRef.current.get(loadKey) ?? Date.now();
    void waitForUnifiedImageRevealGate({
      startedAtMs,
      decode:
        imageElement && typeof imageElement.decode === "function"
          ? () => imageElement.decode()
          : null,
    }).then(() => {
      if (!componentMountedRef.current) return;
      setRevealedImageKeys((current) => {
        if (current.has(loadKey)) return current;
        const next = new Set(current);
        next.add(loadKey);
        return next;
      });
    });
  }, []);

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
      if (!shouldTreatWheelAsHorizontal(event)) return;

      event.preventDefault();
      const now = Date.now();

      if (now - wheelLastEventAtRef.current > WHEEL_GESTURE_IDLE_RESET_MS) {
        wheelAccumulatorRef.current = 0;
      }
      wheelLastEventAtRef.current = now;

      wheelAccumulatorRef.current = accumulateWheelDelta({
        accumulatedDelta: wheelAccumulatorRef.current,
        nextDelta: resolveWheelDelta(event),
      });
      const direction = resolveWheelDirectionFromAccumulatedDelta(wheelAccumulatorRef.current);
      if (!direction) return;

      if (
        shouldThrottleWheelNavigation({
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
          "h-full overflow-hidden overscroll-x-contain",
          shouldShowControls && "cursor-grab active:cursor-grabbing"
        )}
        ref={setViewportRef}
        style={{ touchAction: "pan-y pinch-zoom" }}
        data-testid={`${rootTestId}-viewport`}
      >
        <div
          className={cn("flex h-full snap-x snap-mandatory overscroll-x-contain")}
          style={{ touchAction: "pan-y pinch-zoom" }}
          data-testid={`${rootTestId}-track`}
        >
          {imageItems.map((item, index) => {
            const slideKey = item.id ?? `slide-${index}`;
            const loadKey = `${item.id ?? index}:${item.src}`;
            const isActiveSlide = index === boundedSelectedIndex;
            const shouldRenderImage = mountedImageIndexes.has(index);
            const imageLoaded = revealedImageKeys.has(loadKey);
            const placeholder = resolveUnifiedImagePlaceholderPresentation({
              item,
              fallbackBlurDataURL: blurDataURL,
            });
            const bypassOptimizer = shouldBypassNextImageOptimizer(item.src);
            const unoptimized = shouldDisableImageOptimizationForUsage({
              mode: optimizationMode,
              usage: "critical",
              bypassOptimizer,
            });
            const imageLoading = resolveImageLoadingProfile(prioritizeFirstImage && index === 0);
            const imageElement = (
              <div
                className={cn(
                  "relative h-full w-full overflow-hidden",
                  UNIFIED_CAROUSEL_PREMIUM_NEUTRAL_SLIDE_BACKGROUND_CLASS
                )}
                style={{ backgroundColor: placeholder.dominantColor }}
              >
                <div
                  className="absolute inset-0 scale-[1.04]"
                  style={placeholder.style}
                  data-placeholder-source={placeholder.source}
                  data-placeholder-persistent="true"
                  aria-hidden
                />
                <div className="absolute inset-0 bg-gradient-to-b from-white/8 via-transparent to-slate-900/28" aria-hidden />
                {shouldRenderImage ? (
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    className={cn(
                      "select-none object-cover transition-opacity duration-300",
                      imageLoaded ? "opacity-100" : "opacity-0",
                      imageClassName
                    )}
                    sizes={sizes}
                    priority={imageLoading.priority}
                    loading={imageLoading.loading}
                    fetchPriority={imageLoading.fetchPriority}
                    decoding="async"
                    placeholder="blur"
                    blurDataURL={placeholder.blurDataURL}
                    draggable={false}
                    unoptimized={unoptimized}
                    loader={unoptimized ? directImageLoader : undefined}
                    onLoad={(event) => {
                      handleImageLoad(loadKey, event.currentTarget);
                    }}
                    onError={() => {
                      setLoadedImageKeys((current) => {
                        if (current.has(loadKey)) return current;
                        const next = new Set(current);
                        next.add(loadKey);
                        return next;
                      });
                      setRevealedImageKeys((current) => {
                        if (current.has(loadKey)) return current;
                        const next = new Set(current);
                        next.add(loadKey);
                        return next;
                      });
                      handleImageError(item.src);
                      onImageError?.({ imageUrl: item.src, index });
                    }}
                  />
                ) : null}
              </div>
            );

            return (
              <div
                key={slideKey}
                className={cn(
                  "relative h-full w-full flex-none snap-start",
                  UNIFIED_CAROUSEL_PREMIUM_NEUTRAL_SLIDE_BACKGROUND_CLASS,
                  shouldAnimateSlides &&
                    "transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
                  applyInertialSnapHint({
                    enabled: shouldAnimateSlides,
                    isActive: isActiveSlide,
                  }),
                  slideClassName
                )}
                style={{ backgroundColor: placeholder.dominantColor }}
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

      {showLoadingCue ? (
        <span
          className={cn(
            "pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-white/30 bg-slate-900/65 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/90 transition-opacity duration-200",
            shouldShowDebouncedLoadingCue ? "opacity-100" : "opacity-0"
          )}
          data-testid={`${rootTestId}-loading-cue`}
          aria-hidden={!shouldShowDebouncedLoadingCue}
          aria-live={shouldShowDebouncedLoadingCue ? "polite" : undefined}
        >
          Loading...
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
          className={cn("absolute inset-x-0 bottom-2 z-10 flex items-center justify-center gap-1", dotsClassName)}
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
                index === boundedSelectedIndex ? "bg-white" : "bg-white/55"
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
