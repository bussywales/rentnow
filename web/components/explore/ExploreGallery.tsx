"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { UnifiedImageCarousel } from "@/components/ui/UnifiedImageCarousel";
import { resolvePropertyImageSources } from "@/components/properties/PropertyImageCarousel";
import { getPrimaryImageUrl } from "@/lib/properties/images";
import type { Property } from "@/lib/types";

const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80";

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

export function ExploreGallery({
  property,
  prioritizeFirstImage = false,
  onGestureLockChange,
  onLongPress,
}: ExploreGalleryProps) {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const gestureAxisRef = useRef<GestureAxis>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const [horizontalLockActive, setHorizontalLockActive] = useState(false);
  const imageSources = useMemo(
    () =>
      resolvePropertyImageSources({
        coverImageUrl: property.cover_image_url,
        images: property.images,
        primaryImageUrl: getPrimaryImageUrl(property),
        fallbackImage: FALLBACK_IMAGE,
      }),
    [property]
  );

  const items = useMemo(
    () =>
      imageSources.map((imageUrl, index) => ({
        id: `${property.id}-explore-${index}`,
        src: imageUrl,
        alt: property.title,
      })),
    [imageSources, property.id, property.title]
  );

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
    setHorizontalLockActive(false);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPress?.();
    }, 520);
  }, [onLongPress]);

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
    setHorizontalLockActive(axis === "horizontal");
  }, [cancelLongPress]);

  const clearGesture = useCallback(() => {
    cancelLongPress();
    pointerStartRef.current = null;
    gestureAxisRef.current = null;
    longPressTriggeredRef.current = false;
    setHorizontalLockActive(false);
  }, [cancelLongPress]);

  useEffect(
    () => () => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    },
    []
  );

  return (
    <div
      className="h-full w-full"
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMoveCapture={handlePointerMoveCapture}
      onPointerUpCapture={clearGesture}
      onPointerCancelCapture={clearGesture}
      onPointerLeave={clearGesture}
      style={{ touchAction: horizontalLockActive ? "pan-x" : undefined }}
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
      />
    </div>
  );
}
