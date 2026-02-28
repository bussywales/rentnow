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

function ExploreGalleryInner({
  property,
  prioritizeFirstImage = false,
  onGestureLockChange,
  onLongPress,
}: ExploreGalleryProps) {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const gestureAxisRef = useRef<GestureAxis>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const loggedFailuresRef = useRef<Set<string>>(new Set());
  const [horizontalLockActive, setHorizontalLockActive] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [failedImageIndexes, setFailedImageIndexes] = useState<Set<number>>(new Set());
  const rawImageSources = useMemo(
    () =>
      resolvePropertyImageSources({
        coverImageUrl: property.cover_image_url,
        images: property.images,
        primaryImageUrl: getPrimaryImageUrl(property),
        fallbackImage: FALLBACK_IMAGE,
      }),
    [property]
  );

  const imageSources = useMemo(
    () => rawImageSources.map((source) => normalizeExploreGalleryImageUrl(source, FALLBACK_IMAGE)),
    [rawImageSources]
  );

  const totalImages = imageSources.length;
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

  useEffect(() => {
    onGestureLockChange?.(horizontalLockActive);
  }, [horizontalLockActive, onGestureLockChange]);

  useEffect(
    () => () => {
      onGestureLockChange?.(false);
    },
    [onGestureLockChange]
  );

  const handlePointerDownCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    gestureAxisRef.current = null;
    longPressTriggeredRef.current = false;
    setHorizontalLock(false);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPress?.();
    }, 520);
  }, [onLongPress, setHorizontalLock]);

  const cancelLongPress = useCallback(() => {
    if (!longPressTimerRef.current) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }, []);

  const handlePointerMoveCapture = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current || longPressTriggeredRef.current) return;
    if (Math.abs(event.clientX - pointerStartRef.current.x) > 8 || Math.abs(event.clientY - pointerStartRef.current.y) > 8) {
      cancelLongPress();
    }
    if (gestureAxisRef.current) return;
    const axis = resolveExploreGestureAxis(
      event.clientX - pointerStartRef.current.x,
      event.clientY - pointerStartRef.current.y
    );
    if (!axis) return;
    gestureAxisRef.current = axis;
    cancelLongPress();
    setHorizontalLock(axis === "horizontal");
  }, [cancelLongPress, setHorizontalLock]);

  const clearGesture = useCallback(() => {
    cancelLongPress();
    pointerStartRef.current = null;
    gestureAxisRef.current = null;
    longPressTriggeredRef.current = false;
    setHorizontalLock(false);
  }, [cancelLongPress, setHorizontalLock]);

  const handleTouchStartCapture = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerStartRef.current = { x: touch.clientX, y: touch.clientY };
    gestureAxisRef.current = null;
    longPressTriggeredRef.current = false;
    setHorizontalLock(false);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPress?.();
    }, 520);
  }, [onLongPress, setHorizontalLock]);

  const handleTouchMoveCapture = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch || !pointerStartRef.current || longPressTriggeredRef.current) return;
    if (Math.abs(touch.clientX - pointerStartRef.current.x) > 8 || Math.abs(touch.clientY - pointerStartRef.current.y) > 8) {
      cancelLongPress();
    }
    if (!gestureAxisRef.current) {
      const axis = resolveExploreGestureAxis(
        touch.clientX - pointerStartRef.current.x,
        touch.clientY - pointerStartRef.current.y
      );
      if (axis) {
        gestureAxisRef.current = axis;
        cancelLongPress();
        setHorizontalLock(axis === "horizontal");
      }
    }
    if (gestureAxisRef.current === "horizontal" && event.cancelable) {
      event.preventDefault();
    }
  }, [cancelLongPress, setHorizontalLock]);

  useEffect(
    () => () => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const clearGestureFromEvent = (event: Event) => {
      if (!shouldResetExploreGestureLock(event.type)) return;
      clearGesture();
    };
    const clearGestureFromVisibility = () => {
      if (document.visibilityState !== "visible") {
        clearGesture();
      }
    };
    const clearGestureFromBlur = () => {
      clearGesture();
    };

    window.addEventListener("pointerup", clearGestureFromEvent, { passive: true });
    window.addEventListener("pointercancel", clearGestureFromEvent, { passive: true });
    window.addEventListener("touchend", clearGestureFromEvent, { passive: true });
    window.addEventListener("touchcancel", clearGestureFromEvent, { passive: true });
    window.addEventListener("blur", clearGestureFromBlur, { passive: true });
    document.addEventListener("visibilitychange", clearGestureFromVisibility, { passive: true });

    return () => {
      window.removeEventListener("pointerup", clearGestureFromEvent);
      window.removeEventListener("pointercancel", clearGestureFromEvent);
      window.removeEventListener("touchend", clearGestureFromEvent);
      window.removeEventListener("touchcancel", clearGestureFromEvent);
      window.removeEventListener("blur", clearGestureFromBlur);
      document.removeEventListener("visibilitychange", clearGestureFromVisibility);
    };
  }, [clearGesture]);

  return (
    <div
      className="h-full w-full touch-pan-x"
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMoveCapture={handlePointerMoveCapture}
      onPointerUpCapture={clearGesture}
      onPointerCancelCapture={clearGesture}
      onPointerLeave={clearGesture}
      onTouchStartCapture={handleTouchStartCapture}
      onTouchMoveCapture={handleTouchMoveCapture}
      onTouchEndCapture={clearGesture}
      onTouchCancelCapture={clearGesture}
      style={{
        touchAction: horizontalLockActive ? "pan-x pinch-zoom" : "pan-x pan-y pinch-zoom",
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
        showCountBadge={items.length > 1}
        prioritizeFirstImage={prioritizeFirstImage}
        onSelectedIndexChange={setActiveImageIndex}
        renderWindowRadius={1}
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
