"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, TouchEvent } from "react";
import { UnifiedImageCarousel } from "@/components/ui/UnifiedImageCarousel";
import { resolvePropertyImageSources } from "@/components/properties/PropertyImageCarousel";
import { getPrimaryImageUrl } from "@/lib/properties/images";
import type { Property } from "@/lib/types";
import {
  EXPLORE_GALLERY_FALLBACK_IMAGE,
  normalizeExploreGalleryImageUrl,
  resolveExploreImagePlaceholderMeta,
  resolveExplorePropertyImageRecords,
  resolveExploreGalleryDisplaySource,
} from "@/lib/explore/gallery-images";
import {
  readShouldConserveData,
  subscribeToConserveDataChanges,
} from "@/lib/explore/network-hints";

const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
const FALLBACK_IMAGE = EXPLORE_GALLERY_FALLBACK_IMAGE;

type ExploreGalleryProps = {
  property: Property;
  slideDistance?: number;
  prioritizeFirstImage?: boolean;
  onGestureLockChange?: (locked: boolean) => void;
  onLongPress?: () => void;
};

type GestureAxis = "horizontal" | "vertical" | null;

export function resolveExploreGestureAxis(deltaX: number, deltaY: number, threshold = 8): GestureAxis {
  const absoluteX = Math.abs(deltaX);
  const absoluteY = Math.abs(deltaY);
  if (absoluteX < threshold && absoluteY < threshold) return null;
  if (absoluteX > absoluteY + threshold) return "horizontal";
  if (absoluteY > absoluteX + threshold) return "vertical";
  return null;
}

export function shouldResetExploreGestureLock(eventType: string): boolean {
  return eventType === "pointerup" || eventType === "pointercancel" || eventType === "touchend" || eventType === "touchcancel";
}

const EXPLORE_GESTURE_LOCK_SAFETY_TIMEOUT_MS = 600;
export function getExploreGestureLockSafetyTimeoutMs(): number {
  return EXPLORE_GESTURE_LOCK_SAFETY_TIMEOUT_MS;
}

export function shouldRestrictExploreSlideToHeroImage(shouldConserveData: boolean, slideDistance: number): boolean {
  return shouldConserveData && slideDistance > 0;
}

export function resolveExploreGalleryRenderWindowRadius(input: {
  canSwipeImages: boolean;
  shouldConserveData: boolean;
}): number {
  if (!input.canSwipeImages) return 0;
  return 1;
}

export function resolveExploreGalleryMaxConcurrentImageLoads(shouldConserveData: boolean): number {
  return shouldConserveData ? 2 : 4;
}

function ExploreGalleryInner({
  property,
  slideDistance = 0,
  prioritizeFirstImage = false,
  onGestureLockChange,
  onLongPress,
}: ExploreGalleryProps) {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const gestureAxisRef = useRef<GestureAxis>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const gestureLockSafetyTimeoutRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const loggedFailuresRef = useRef<Set<string>>(new Set());
  const [horizontalLockActive, setHorizontalLockActive] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [failedImageIndexes, setFailedImageIndexes] = useState<Set<number>>(new Set());
  const [shouldConserveDataState, setShouldConserveDataState] = useState(() => readShouldConserveData());
  const propertyImages = useMemo(() => resolveExplorePropertyImageRecords(property), [property]);
  const rawImageSources = useMemo(
    () =>
      resolvePropertyImageSources({
        coverImageUrl: property.cover_image_url,
        images: propertyImages,
        primaryImageUrl: getPrimaryImageUrl(property),
        fallbackImage: FALLBACK_IMAGE,
      }),
    [property, propertyImages]
  );

  const imageEntries = useMemo(() => {
    const imageRecordByNormalizedUrl = new Map<string, (typeof propertyImages)[number]>();
    propertyImages.forEach((imageRecord) => {
      const normalizedImageUrl = normalizeExploreGalleryImageUrl(imageRecord?.image_url, FALLBACK_IMAGE);
      if (!normalizedImageUrl || imageRecordByNormalizedUrl.has(normalizedImageUrl)) return;
      imageRecordByNormalizedUrl.set(normalizedImageUrl, imageRecord);
    });
    return rawImageSources.map((source) => {
      const normalizedImageUrl = normalizeExploreGalleryImageUrl(source, FALLBACK_IMAGE);
      const imageRecord = imageRecordByNormalizedUrl.get(normalizedImageUrl) ?? null;
      const placeholder = resolveExploreImagePlaceholderMeta({
        imageUrl: normalizedImageUrl,
        imageRecord,
      });
      return {
        normalizedImageUrl,
        placeholder,
      };
    });
  }, [propertyImages, rawImageSources]);

  const restrictToHeroImage = shouldRestrictExploreSlideToHeroImage(shouldConserveDataState, slideDistance);
  const visibleImageEntries = useMemo(
    () => (restrictToHeroImage ? imageEntries.slice(0, 1) : imageEntries),
    [imageEntries, restrictToHeroImage]
  );
  const totalImages = visibleImageEntries.length;
  const effectiveActiveImageIndex = Math.min(activeImageIndex, Math.max(0, totalImages - 1));
  const canSwipeImages = totalImages > 1 && slideDistance === 0;
  const renderWindowRadius = resolveExploreGalleryRenderWindowRadius({
    canSwipeImages,
    shouldConserveData: shouldConserveDataState,
  });
  const maxConcurrentImageLoads = resolveExploreGalleryMaxConcurrentImageLoads(shouldConserveDataState);
  const items = useMemo(
    () =>
      visibleImageEntries.map((entry, index) => ({
        id: `${property.id}-explore-${index}`,
        src: resolveExploreGalleryDisplaySource({
          imageUrl: entry.normalizedImageUrl,
          imageIndex: index,
          activeIndex: effectiveActiveImageIndex,
          totalImages,
          failedIndexes: failedImageIndexes,
          fallbackImage: FALLBACK_IMAGE,
          windowRadius: renderWindowRadius,
        }),
        alt: property.title,
        placeholderColor: entry.placeholder.dominantColor,
        placeholderBlurDataURL: entry.placeholder.blurDataURL,
        placeholderSource: entry.placeholder.source,
      })),
    [
      effectiveActiveImageIndex,
      failedImageIndexes,
      property.id,
      property.title,
      renderWindowRadius,
      totalImages,
      visibleImageEntries,
    ]
  );
  const activeImageUnavailable = failedImageIndexes.has(effectiveActiveImageIndex);

  const setHorizontalLock = useCallback((next: boolean) => {
    setHorizontalLockActive((current) => (current === next ? current : next));
  }, []);

  const clearGestureLockSafetyTimeout = useCallback(() => {
    if (!gestureLockSafetyTimeoutRef.current) return;
    window.clearTimeout(gestureLockSafetyTimeoutRef.current);
    gestureLockSafetyTimeoutRef.current = null;
  }, []);

  const cancelLongPress = useCallback(() => {
    if (!longPressTimerRef.current) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }, []);

  const resetGestureLock = useCallback(() => {
    clearGestureLockSafetyTimeout();
    cancelLongPress();
    pointerStartRef.current = null;
    gestureAxisRef.current = null;
    longPressTriggeredRef.current = false;
    setHorizontalLock(false);
  }, [cancelLongPress, clearGestureLockSafetyTimeout, setHorizontalLock]);

  const scheduleGestureLockSafetyReset = useCallback(() => {
    if (typeof window === "undefined") return;
    clearGestureLockSafetyTimeout();
    gestureLockSafetyTimeoutRef.current = window.setTimeout(() => {
      resetGestureLock();
    }, getExploreGestureLockSafetyTimeoutMs());
  }, [clearGestureLockSafetyTimeout, resetGestureLock]);

  useEffect(() => {
    onGestureLockChange?.(horizontalLockActive);
  }, [horizontalLockActive, onGestureLockChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncConserveData = () => {
      setShouldConserveDataState((current) => {
        const next = readShouldConserveData();
        return current === next ? current : next;
      });
    };
    syncConserveData();
    const unsubscribe = subscribeToConserveDataChanges((next) => {
      setShouldConserveDataState((current) => (current === next ? current : next));
    });
    window.addEventListener("online", syncConserveData, { passive: true });
    return () => {
      unsubscribe();
      window.removeEventListener("online", syncConserveData);
    };
  }, []);

  useEffect(
    () => () => {
      resetGestureLock();
    },
    [resetGestureLock]
  );

  const handlePointerDownCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    clearGestureLockSafetyTimeout();
    cancelLongPress();
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    gestureAxisRef.current = null;
    longPressTriggeredRef.current = false;
    setHorizontalLock(false);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPress?.();
    }, 520);
  }, [cancelLongPress, clearGestureLockSafetyTimeout, onLongPress, setHorizontalLock]);

  const handlePointerMoveCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current || longPressTriggeredRef.current) return;
    if (Math.abs(event.clientX - pointerStartRef.current.x) > 8 || Math.abs(event.clientY - pointerStartRef.current.y) > 8) {
      cancelLongPress();
    }
    if (!canSwipeImages) return;
    if (gestureAxisRef.current === "horizontal") {
      scheduleGestureLockSafetyReset();
      return;
    }
    if (gestureAxisRef.current) return;
    const axis = resolveExploreGestureAxis(
      event.clientX - pointerStartRef.current.x,
      event.clientY - pointerStartRef.current.y
    );
    if (!axis) return;
    gestureAxisRef.current = axis;
    cancelLongPress();
    const horizontalLock = axis === "horizontal";
    setHorizontalLock(horizontalLock);
    if (horizontalLock) {
      scheduleGestureLockSafetyReset();
    }
  }, [cancelLongPress, canSwipeImages, scheduleGestureLockSafetyReset, setHorizontalLock]);

  const handleTouchStartCapture = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    clearGestureLockSafetyTimeout();
    cancelLongPress();
    pointerStartRef.current = { x: touch.clientX, y: touch.clientY };
    gestureAxisRef.current = null;
    longPressTriggeredRef.current = false;
    setHorizontalLock(false);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPress?.();
    }, 520);
  }, [cancelLongPress, clearGestureLockSafetyTimeout, onLongPress, setHorizontalLock]);

  const handleTouchMoveCapture = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch || !pointerStartRef.current || longPressTriggeredRef.current) return;
    if (Math.abs(touch.clientX - pointerStartRef.current.x) > 8 || Math.abs(touch.clientY - pointerStartRef.current.y) > 8) {
      cancelLongPress();
    }
    if (!canSwipeImages) return;
    if (gestureAxisRef.current === "horizontal") {
      scheduleGestureLockSafetyReset();
      return;
    }
    if (!gestureAxisRef.current) {
      const axis = resolveExploreGestureAxis(
        touch.clientX - pointerStartRef.current.x,
        touch.clientY - pointerStartRef.current.y
      );
      if (axis) {
        gestureAxisRef.current = axis;
        cancelLongPress();
        const horizontalLock = axis === "horizontal";
        setHorizontalLock(horizontalLock);
        if (horizontalLock) {
          scheduleGestureLockSafetyReset();
        }
      }
    }
  }, [cancelLongPress, canSwipeImages, scheduleGestureLockSafetyReset, setHorizontalLock]);

  useEffect(
    () => () => {
      cancelLongPress();
      clearGestureLockSafetyTimeout();
    },
    [cancelLongPress, clearGestureLockSafetyTimeout]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const resetGestureLockFromEvent = (event: Event) => {
      if (!shouldResetExploreGestureLock(event.type)) return;
      resetGestureLock();
    };
    const resetGestureLockFromVisibility = () => {
      if (document.visibilityState !== "visible") {
        resetGestureLock();
      }
    };
    const resetGestureLockFromBlur = () => {
      resetGestureLock();
    };

    window.addEventListener("pointerup", resetGestureLockFromEvent, { passive: true });
    window.addEventListener("pointercancel", resetGestureLockFromEvent, { passive: true });
    window.addEventListener("touchend", resetGestureLockFromEvent, { passive: true });
    window.addEventListener("touchcancel", resetGestureLockFromEvent, { passive: true });
    window.addEventListener("blur", resetGestureLockFromBlur, { passive: true });
    document.addEventListener("visibilitychange", resetGestureLockFromVisibility, { passive: true });

    return () => {
      window.removeEventListener("pointerup", resetGestureLockFromEvent);
      window.removeEventListener("pointercancel", resetGestureLockFromEvent);
      window.removeEventListener("touchend", resetGestureLockFromEvent);
      window.removeEventListener("touchcancel", resetGestureLockFromEvent);
      window.removeEventListener("blur", resetGestureLockFromBlur);
      document.removeEventListener("visibilitychange", resetGestureLockFromVisibility);
    };
  }, [resetGestureLock]);

  return (
    <div
      className={
        canSwipeImages
          ? "relative h-full min-h-[100svh] w-full overflow-hidden aspect-[4/5] md:aspect-auto touch-pan-x"
          : "relative h-full min-h-[100svh] w-full overflow-hidden aspect-[4/5] md:aspect-auto touch-pan-y"
      }
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMoveCapture={handlePointerMoveCapture}
      onPointerUpCapture={resetGestureLock}
      onPointerCancelCapture={resetGestureLock}
      onPointerLeave={resetGestureLock}
      onTouchStartCapture={handleTouchStartCapture}
      onTouchMoveCapture={handleTouchMoveCapture}
      onTouchEndCapture={resetGestureLock}
      onTouchCancelCapture={resetGestureLock}
      style={{
        touchAction: canSwipeImages
          ? "pan-x pan-y pinch-zoom"
          : "pan-y pinch-zoom",
        overscrollBehaviorX: "contain",
      }}
      data-testid="explore-gallery-gesture-layer"
      data-gallery-shell="reserved"
    >
      <UnifiedImageCarousel
        items={items}
        fallbackImage={FALLBACK_IMAGE}
        blurDataURL={BLUR_DATA_URL}
        sizes="100vw"
        className="h-full min-h-[100svh] w-full bg-slate-900"
        imageClassName="object-cover"
        slideClassName="h-full"
        rootTestId="explore-gallery"
        dotsTestId="explore-gallery-dots"
        showArrows={false}
        showDots={false}
        showCountBadge={canSwipeImages}
        prioritizeFirstImage={prioritizeFirstImage}
        onSelectedIndexChange={(nextIndex) => {
          const bounded = Math.min(nextIndex, Math.max(0, totalImages - 1));
          setActiveImageIndex((current) => (current === bounded ? current : bounded));
        }}
        renderWindowRadius={renderWindowRadius}
        progressiveUpgradeOnIdle={shouldConserveDataState && canSwipeImages}
        maxConcurrentImageLoads={maxConcurrentImageLoads}
        showLoadingCue={slideDistance === 0}
        onImageError={({ imageUrl, index }) => {
          setFailedImageIndexes((current) => {
            if (current.has(index)) return current;
            const next = new Set(current);
            next.add(index);
            return next;
          });
          if (process.env.NODE_ENV === "production") return;
          const key = `${property.id}:${index}:${imageUrl}`;
          if (loggedFailuresRef.current.has(key)) return;
          loggedFailuresRef.current.add(key);
          console.warn("[explore-gallery][image-error]", {
            listingId: property.id,
            imageIndex: index,
            imageUrl,
          });
        }}
      />
      {activeImageUnavailable ? (
        <span
          className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-full border border-white/30 bg-slate-900/65 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90"
          data-testid="explore-gallery-image-unavailable"
          aria-live="polite"
        >
          Image unavailable
        </span>
      ) : null}
    </div>
  );
}

function areExploreGalleryPropsEqual(prev: ExploreGalleryProps, next: ExploreGalleryProps): boolean {
  return (
    prev.property === next.property &&
    prev.slideDistance === next.slideDistance &&
    prev.prioritizeFirstImage === next.prioritizeFirstImage &&
    prev.onGestureLockChange === next.onGestureLockChange &&
    prev.onLongPress === next.onLongPress
  );
}

export const ExploreGallery = memo(ExploreGalleryInner, areExploreGalleryPropsEqual);
