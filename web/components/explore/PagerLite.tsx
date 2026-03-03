"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

export const PAGER_LITE_AXIS_THRESHOLD_PX = 10;
export const PAGER_LITE_MIN_SWIPE_DISTANCE_PX = 56;
export const PAGER_LITE_SWIPE_DISTANCE_RATIO = 0.16;
export const PAGER_LITE_SWIPE_VELOCITY_THRESHOLD = 0.45;
export const PAGER_LITE_SNAP_DURATION_MS = 220;
export const PAGER_LITE_WHEEL_THRESHOLD_PX = 80;
export const PAGER_LITE_WHEEL_COOLDOWN_MS = 220;
export const PAGER_LITE_WHEEL_IDLE_RESET_MS = 240;
const PAGER_LITE_CAROUSEL_SELECTOR = '[data-testid="explore-gallery-gesture-layer"]';

type PagerLiteAxis = "horizontal" | "vertical" | null;
type PagerLiteWheelDirection = "next" | "prev";

type PagerLiteGestureState = {
  active: boolean;
  activePointerId: number | null;
  axis: PagerLiteAxis;
  startX: number;
  startY: number;
  lastY: number;
  lastTimestamp: number;
  deltaY: number;
  velocityY: number;
  startedInsideCarousel: boolean;
};

type PagerLiteSlot = {
  name: "prev" | "current" | "next";
  index: number;
  slotOffset: -1 | 0 | 1;
};

export type PagerLiteProps = {
  totalSlides: number;
  activeIndex: number;
  onActiveIndexChange: (nextIndex: number) => void;
  renderSlide: (index: number) => ReactNode;
  resolveSlideKey?: (index: number) => string;
  gestureLocked?: boolean;
  testId?: string;
};

function createIdleGestureState(): PagerLiteGestureState {
  return {
    active: false,
    activePointerId: null,
    axis: null,
    startX: 0,
    startY: 0,
    lastY: 0,
    lastTimestamp: 0,
    deltaY: 0,
    velocityY: 0,
    startedInsideCarousel: false,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resolvePagerLiteAxis(
  deltaX: number,
  deltaY: number,
  threshold = PAGER_LITE_AXIS_THRESHOLD_PX
): PagerLiteAxis {
  if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) return null;
  if (Math.abs(deltaX) > Math.abs(deltaY)) return "horizontal";
  return "vertical";
}

export function resolvePagerLiteSlots(activeIndex: number, totalSlides: number): PagerLiteSlot[] {
  const boundedTotal = Math.max(1, totalSlides);
  const boundedIndex = clamp(activeIndex, 0, boundedTotal - 1);
  const prevIndex = Math.max(0, boundedIndex - 1);
  const nextIndex = Math.min(boundedTotal - 1, boundedIndex + 1);
  return [
    { name: "prev", index: prevIndex, slotOffset: -1 },
    { name: "current", index: boundedIndex, slotOffset: 0 },
    { name: "next", index: nextIndex, slotOffset: 1 },
  ];
}

export function resolvePagerLiteRelease(input: {
  activeIndex: number;
  totalSlides: number;
  deltaY: number;
  velocityY: number;
  viewportHeight: number;
}): number {
  if (input.totalSlides <= 1) return input.activeIndex;
  const distanceThreshold = Math.max(
    PAGER_LITE_MIN_SWIPE_DISTANCE_PX,
    input.viewportHeight * PAGER_LITE_SWIPE_DISTANCE_RATIO
  );
  const shouldAdvanceByDistance = Math.abs(input.deltaY) >= distanceThreshold;
  const shouldAdvanceByVelocity = Math.abs(input.velocityY) >= PAGER_LITE_SWIPE_VELOCITY_THRESHOLD;
  if (!shouldAdvanceByDistance && !shouldAdvanceByVelocity) {
    return input.activeIndex;
  }
  const direction = input.deltaY < 0 || input.velocityY < 0 ? 1 : -1;
  const candidate = input.activeIndex + direction;
  return clamp(candidate, 0, input.totalSlides - 1);
}

export function accumulatePagerLiteWheelDelta(input: {
  accumulatedDelta: number;
  nextDelta: number;
}): number {
  const accumulatedDelta = Number.isFinite(input.accumulatedDelta) ? input.accumulatedDelta : 0;
  const nextDelta = Number.isFinite(input.nextDelta) ? input.nextDelta : 0;

  if (nextDelta === 0) return accumulatedDelta;
  if (accumulatedDelta === 0) return nextDelta;
  if (Math.sign(accumulatedDelta) !== Math.sign(nextDelta)) return nextDelta;
  return accumulatedDelta + nextDelta;
}

export function resolvePagerLiteWheelDirectionFromAccumulatedDelta(
  accumulatedDelta: number,
  thresholdPx = PAGER_LITE_WHEEL_THRESHOLD_PX
): PagerLiteWheelDirection | null {
  if (accumulatedDelta >= thresholdPx) return "next";
  if (accumulatedDelta <= -thresholdPx) return "prev";
  return null;
}

export function shouldThrottlePagerLiteWheelNavigation(input: {
  nowMs: number;
  lastTriggeredAtMs: number;
  nextDirection: PagerLiteWheelDirection;
  lastDirection: PagerLiteWheelDirection | null;
  cooldownMs?: number;
}): boolean {
  const cooldownMs = input.cooldownMs ?? PAGER_LITE_WHEEL_COOLDOWN_MS;
  const withinCooldown = input.nowMs - input.lastTriggeredAtMs < cooldownMs;
  if (!withinCooldown) return false;
  return input.nextDirection === input.lastDirection;
}

function startedInsideCarousel(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(PAGER_LITE_CAROUSEL_SELECTOR));
}

export const PagerLite = memo(function PagerLite({
  totalSlides,
  activeIndex,
  onActiveIndexChange,
  renderSlide,
  resolveSlideKey,
  gestureLocked = false,
  testId = "explore-pager-lite",
}: PagerLiteProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const gestureStateRef = useRef<PagerLiteGestureState>(createIdleGestureState());
  const snapTimerRef = useRef<number | null>(null);
  const activeIndexRef = useRef(activeIndex);
  const totalSlidesRef = useRef(totalSlides);
  const isSnappingRef = useRef(false);
  const wheelAccumulatorRef = useRef(0);
  const wheelLastEventAtRef = useRef(0);
  const wheelLastTriggeredAtRef = useRef(0);
  const wheelLastDirectionRef = useRef<PagerLiteWheelDirection | null>(null);

  const [viewportHeight, setViewportHeight] = useState(() => {
    if (typeof window === "undefined") return 1;
    return Math.max(1, window.innerHeight || 1);
  });
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    totalSlidesRef.current = totalSlides;
  }, [totalSlides]);

  useEffect(() => {
    isSnappingRef.current = isSnapping;
  }, [isSnapping]);

  const clearSnapTimer = useCallback(() => {
    if (snapTimerRef.current === null) return;
    window.clearTimeout(snapTimerRef.current);
    snapTimerRef.current = null;
  }, []);

  const hardResetGestureState = useCallback(() => {
    gestureStateRef.current = createIdleGestureState();
    setDragOffsetPx(0);
  }, []);

  const refreshViewportHeight = useCallback(() => {
    const next = Math.max(1, rootRef.current?.clientHeight || window.innerHeight || 1);
    setViewportHeight((current) => (current === next ? current : next));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("resize", refreshViewportHeight, { passive: true });
    window.visualViewport?.addEventListener("resize", refreshViewportHeight, { passive: true });
    return () => {
      window.removeEventListener("resize", refreshViewportHeight);
      window.visualViewport?.removeEventListener("resize", refreshViewportHeight);
    };
  }, [refreshViewportHeight]);

  const snapToOffset = useCallback(
    (targetOffset: number, nextIndex: number | null) => {
      clearSnapTimer();
      setIsSnapping(true);
      setDragOffsetPx(targetOffset);
      snapTimerRef.current = window.setTimeout(() => {
        if (nextIndex !== null) {
          onActiveIndexChange(nextIndex);
        }
        requestAnimationFrame(() => {
          setIsSnapping(false);
          setDragOffsetPx(0);
        });
      }, PAGER_LITE_SNAP_DURATION_MS);
    },
    [clearSnapTimer, onActiveIndexChange]
  );

  const triggerDirectionalSnap = useCallback(
    (direction: PagerLiteWheelDirection) => {
      const currentIndex = activeIndexRef.current;
      const directionDelta = direction === "next" ? 1 : -1;
      const nextIndex = clamp(currentIndex + directionDelta, 0, totalSlidesRef.current - 1);
      if (nextIndex === currentIndex) {
        snapToOffset(0, null);
        return;
      }
      snapToOffset(direction === "next" ? -viewportHeight : viewportHeight, nextIndex);
    },
    [snapToOffset, viewportHeight]
  );

  const finalizeGesture = useCallback(() => {
    const gesture = gestureStateRef.current;
    if (!gesture.active) {
      hardResetGestureState();
      return;
    }
    if (gesture.startedInsideCarousel || gesture.axis !== "vertical") {
      hardResetGestureState();
      return;
    }
    const nextIndex = resolvePagerLiteRelease({
      activeIndex: activeIndexRef.current,
      totalSlides: totalSlidesRef.current,
      deltaY: gesture.deltaY,
      velocityY: gesture.velocityY,
      viewportHeight,
    });
    const direction = Math.sign(nextIndex - activeIndexRef.current);
    if (direction === 0) {
      snapToOffset(0, null);
    } else {
      snapToOffset(direction < 0 ? viewportHeight : -viewportHeight, nextIndex);
    }
    gestureStateRef.current = createIdleGestureState();
  }, [hardResetGestureState, snapToOffset, viewportHeight]);

  const beginGesture = useCallback(
    (input: {
      x: number;
      y: number;
      timestamp: number;
      pointerId?: number | null;
      eventTarget: EventTarget | null;
    }) => {
      if (gestureLocked || isSnappingRef.current) return;
      const next = createIdleGestureState();
      next.active = true;
      next.activePointerId = input.pointerId ?? null;
      next.startX = input.x;
      next.startY = input.y;
      next.lastY = input.y;
      next.lastTimestamp = input.timestamp;
      next.startedInsideCarousel = startedInsideCarousel(input.eventTarget);
      gestureStateRef.current = next;
      setDragOffsetPx(0);
    },
    [gestureLocked]
  );

  const updateGesture = useCallback(
    (input: { x: number; y: number; timestamp: number; pointerId?: number | null }) => {
      const gesture = gestureStateRef.current;
      if (!gesture.active || isSnappingRef.current) return;
      if (
        gesture.activePointerId !== null &&
        input.pointerId !== null &&
        input.pointerId !== gesture.activePointerId
      ) {
        return;
      }
      if (gesture.startedInsideCarousel || gestureLocked) {
        hardResetGestureState();
        return;
      }

      const deltaX = input.x - gesture.startX;
      const deltaY = input.y - gesture.startY;
      if (gesture.axis === null) {
        gesture.axis = resolvePagerLiteAxis(deltaX, deltaY);
      }
      if (gesture.axis !== "vertical") return;

      const deltaTimeMs = Math.max(1, input.timestamp - gesture.lastTimestamp);
      gesture.velocityY = (input.y - gesture.lastY) / deltaTimeMs;
      gesture.lastY = input.y;
      gesture.lastTimestamp = input.timestamp;
      gesture.deltaY = deltaY;

      const currentIndex = activeIndexRef.current;
      const hasPrevious = currentIndex > 0;
      const hasNext = currentIndex < totalSlidesRef.current - 1;
      const isAtBoundary = (deltaY > 0 && !hasPrevious) || (deltaY < 0 && !hasNext);
      const adjustedDelta = isAtBoundary ? deltaY * 0.35 : deltaY;
      setDragOffsetPx(clamp(adjustedDelta, -viewportHeight * 0.95, viewportHeight * 0.95));
    },
    [gestureLocked, hardResetGestureState, viewportHeight]
  );

  useEffect(() => {
    if (!gestureLocked) return;
    const rafId = window.requestAnimationFrame(() => {
      hardResetGestureState();
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [gestureLocked, hardResetGestureState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const resetFromVisibility = () => {
      if (document.visibilityState !== "visible") {
        hardResetGestureState();
      }
    };

    window.addEventListener("pointerup", finalizeGesture, { passive: true });
    window.addEventListener("pointercancel", finalizeGesture, { passive: true });
    window.addEventListener("touchend", finalizeGesture, { passive: true });
    window.addEventListener("touchcancel", finalizeGesture, { passive: true });
    window.addEventListener("blur", hardResetGestureState);
    document.addEventListener("visibilitychange", resetFromVisibility, { passive: true });
    return () => {
      window.removeEventListener("pointerup", finalizeGesture);
      window.removeEventListener("pointercancel", finalizeGesture);
      window.removeEventListener("touchend", finalizeGesture);
      window.removeEventListener("touchcancel", finalizeGesture);
      window.removeEventListener("blur", hardResetGestureState);
      document.removeEventListener("visibilitychange", resetFromVisibility);
    };
  }, [finalizeGesture, hardResetGestureState]);

  useEffect(() => {
    return () => {
      clearSnapTimer();
      hardResetGestureState();
      setIsSnapping(false);
    };
  }, [clearSnapTimer, hardResetGestureState]);

  const slots = useMemo(() => resolvePagerLiteSlots(activeIndex, totalSlides), [activeIndex, totalSlides]);

  return (
    <div
      ref={(node) => {
        rootRef.current = node;
        if (!node || typeof window === "undefined") return;
        const next = Math.max(1, node.clientHeight || window.innerHeight || 1);
        setViewportHeight((current) => (current === next ? current : next));
      }}
      className="relative h-[100svh] overflow-hidden overscroll-y-contain"
      data-testid={testId}
      style={{ touchAction: "pan-y pinch-zoom", overscrollBehaviorY: "contain" }}
      onPointerDownCapture={(event) => {
        if (event.pointerType === "touch") return;
        beginGesture({
          x: event.clientX,
          y: event.clientY,
          timestamp: event.timeStamp,
          pointerId: event.pointerId,
          eventTarget: event.target,
        });
      }}
      onPointerMoveCapture={(event) => {
        if (event.pointerType === "touch") return;
        updateGesture({
          x: event.clientX,
          y: event.clientY,
          timestamp: event.timeStamp,
          pointerId: event.pointerId,
        });
      }}
      onPointerUpCapture={finalizeGesture}
      onPointerCancelCapture={finalizeGesture}
      onTouchStartCapture={(event) => {
        const touch = event.touches[0];
        if (!touch) return;
        beginGesture({
          x: touch.clientX,
          y: touch.clientY,
          timestamp: event.timeStamp,
          eventTarget: event.target,
        });
      }}
      onTouchMoveCapture={(event) => {
        const touch = event.touches[0];
        if (!touch) return;
        updateGesture({
          x: touch.clientX,
          y: touch.clientY,
          timestamp: event.timeStamp,
        });
        if (
          gestureStateRef.current.active &&
          !gestureStateRef.current.startedInsideCarousel &&
          gestureStateRef.current.axis === "vertical"
        ) {
          event.preventDefault();
        }
      }}
      onTouchEndCapture={finalizeGesture}
      onTouchCancelCapture={finalizeGesture}
      onWheelCapture={(event) => {
        if (event.ctrlKey || gestureLocked || isSnappingRef.current) return;
        if (totalSlidesRef.current <= 1) return;
        if (startedInsideCarousel(event.target)) return;
        if (event.cancelable) {
          event.preventDefault();
        }

        const now = Date.now();
        if (now - wheelLastEventAtRef.current > PAGER_LITE_WHEEL_IDLE_RESET_MS) {
          wheelAccumulatorRef.current = 0;
        }
        wheelLastEventAtRef.current = now;
        wheelAccumulatorRef.current = accumulatePagerLiteWheelDelta({
          accumulatedDelta: wheelAccumulatorRef.current,
          nextDelta: event.deltaY,
        });

        const direction = resolvePagerLiteWheelDirectionFromAccumulatedDelta(wheelAccumulatorRef.current);
        if (!direction) return;
        if (
          shouldThrottlePagerLiteWheelNavigation({
            nowMs: now,
            lastTriggeredAtMs: wheelLastTriggeredAtRef.current,
            nextDirection: direction,
            lastDirection: wheelLastDirectionRef.current,
          })
        ) {
          return;
        }

        wheelLastTriggeredAtRef.current = now;
        wheelLastDirectionRef.current = direction;
        wheelAccumulatorRef.current = 0;
        triggerDirectionalSnap(direction);
      }}
    >
      <div className="absolute inset-0" data-testid="explore-pager-lite-track">
        {slots.map((slot) => {
          const slotOffsetPx = slot.slotOffset * viewportHeight + dragOffsetPx;
          const isDuplicateOfCurrent = slot.name !== "current" && slot.index === activeIndex;
          const key = resolveSlideKey?.(slot.index) ?? String(slot.index);
          return (
            <div
              key={slot.name}
              className="absolute inset-0 will-change-transform"
              data-slot={slot.name}
              data-slide-index={slot.index}
              data-slide-key={key}
              style={{
                transform: `translate3d(0, ${slotOffsetPx}px, 0)`,
                transition: isSnapping
                  ? `transform ${PAGER_LITE_SNAP_DURATION_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
                  : "none",
                pointerEvents: slot.name === "current" ? "auto" : "none",
              }}
            >
              {isDuplicateOfCurrent ? (
                <div className="h-full w-full bg-slate-950" aria-hidden />
              ) : (
                renderSlide(slot.index)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
