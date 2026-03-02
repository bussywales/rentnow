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
  resolveExplorePropertyImageRecords,
  resolveExploreGalleryDisplaySource,
} from "@/lib/explore/gallery-images";

const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
const FALLBACK_IMAGE = EXPLORE_GALLERY_FALLBACK_IMAGE;

type ExploreGalleryProps = {
  property: Property;
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

function ExploreGalleryInner({
  property,
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

  const imageSources = useMemo(
    () => rawImageSources.map((source) => normalizeExploreGalleryImageUrl(source, FALLBACK_IMAGE)),
    [rawImageSources]
  );

  const totalImages = imageSources.length;
  const canSwipeImages = totalImages > 1;
  const items = useMemo(
    () =>
      imageSources.map((normalizedImageUrl, index) => ({
        id: `${property.id}-explore-${index}`,
        src: resolveExploreGalleryDisplaySource({
          imageUrl: normalizedImageUrl,
          imageIndex: index,
          activeIndex: activeImageIndex,
          totalImages,
          failedIndexes: failedImageIndexes,
          fallbackImage: FALLBACK_IMAGE,
          windowRadius: 1,
        }),
        alt: property.title,
      })),
    [activeImageIndex, failedImageIndexes, imageSources, property.id, property.title, totalImages]
  );
  const activeImageUnavailable = failedImageIndexes.has(activeImageIndex);

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
      className={canSwipeImages ? "h-full w-full touch-pan-x" : "h-full w-full touch-pan-y"}
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
          ? horizontalLockActive
            ? "pan-x pinch-zoom"
            : "pan-x pan-y pinch-zoom"
          : "pan-y pinch-zoom",
        overscrollBehaviorX: "contain",
      }}
      data-testid="explore-gallery-gesture-layer"
    >
      <UnifiedImageCarousel
        items={items}
        fallbackImage={FALLBACK_IMAGE}
        blurDataURL={BLUR_DATA_URL}
        sizes="100vw"
        className="h-full w-full bg-slate-900"
        imageClassName="object-cover"
        slideClassName="h-full"
        rootTestId="explore-gallery"
        dotsTestId="explore-gallery-dots"
        showArrows={false}
        showDots={false}
        showCountBadge={canSwipeImages}
        prioritizeFirstImage={prioritizeFirstImage}
        onSelectedIndexChange={setActiveImageIndex}
        renderWindowRadius={canSwipeImages ? 1 : 0}
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
    prev.prioritizeFirstImage === next.prioritizeFirstImage &&
    prev.onGestureLockChange === next.onGestureLockChange &&
    prev.onLongPress === next.onLongPress
  );
}

export const ExploreGallery = memo(ExploreGalleryInner, areExploreGalleryPropsEqual);
