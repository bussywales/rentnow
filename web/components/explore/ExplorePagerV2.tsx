"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

export const EXPLORE_PAGER_V2_AXIS_THRESHOLD_PX = 10;
export const EXPLORE_PAGER_V2_SWIPE_DISTANCE_RATIO = 0.16;
export const EXPLORE_PAGER_V2_MIN_SWIPE_DISTANCE_PX = 56;
export const EXPLORE_PAGER_V2_SWIPE_VELOCITY_THRESHOLD = 0.45;
export const EXPLORE_PAGER_V2_SNAP_DURATION_MS = 220;
export const EXPLORE_PAGER_V2_RESET_TIMEOUT_MS = 600;

export type ExplorePagerV2Axis = "horizontal" | "vertical" | null;

type ExplorePagerV2Props = {
  totalSlides: number;
  activeIndex: number;
  onActiveIndexChange: (nextIndex: number) => void;
  renderSlide: (index: number) => ReactNode;
  resolveSlideKey?: (index: number) => string;
  gestureLocked?: boolean;
  testId?: string;
};

type ExplorePagerGestureState = {
  active: boolean;
  axis: ExplorePagerV2Axis;
  startX: number;
  startY: number;
  lastY: number;
  lastTimestamp: number;
  deltaY: number;
  velocityY: number;
};

function createIdleGestureState(): ExplorePagerGestureState {
  return {
    active: false,
    axis: null,
    startX: 0,
    startY: 0,
    lastY: 0,
    lastTimestamp: 0,
    deltaY: 0,
    velocityY: 0,
  };
}

export function resolveExplorePagerV2Axis(
  deltaX: number,
  deltaY: number,
  threshold = EXPLORE_PAGER_V2_AXIS_THRESHOLD_PX
): ExplorePagerV2Axis {
  if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) return null;
  if (Math.abs(deltaX) > Math.abs(deltaY)) return "horizontal";
  return "vertical";
}

export function resolveExplorePagerV2NextIndex({
  activeIndex,
  totalSlides,
  deltaY,
  velocityY,
  viewportHeight,
}: {
  activeIndex: number;
  totalSlides: number;
  deltaY: number;
  velocityY: number;
  viewportHeight: number;
}): number {
  if (totalSlides <= 1) return 0;
  const distanceThreshold = Math.max(
    EXPLORE_PAGER_V2_MIN_SWIPE_DISTANCE_PX,
    viewportHeight * EXPLORE_PAGER_V2_SWIPE_DISTANCE_RATIO
  );
  const shouldAdvanceByDistance = Math.abs(deltaY) >= distanceThreshold;
  const shouldAdvanceByVelocity = Math.abs(velocityY) >= EXPLORE_PAGER_V2_SWIPE_VELOCITY_THRESHOLD;
  if (!shouldAdvanceByDistance && !shouldAdvanceByVelocity) return activeIndex;

  if (deltaY < 0 || velocityY < 0) {
    return Math.min(totalSlides - 1, activeIndex + 1);
  }
  return Math.max(0, activeIndex - 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const ExplorePagerV2 = memo(function ExplorePagerV2({
  totalSlides,
  activeIndex,
  onActiveIndexChange,
  renderSlide,
  resolveSlideKey,
  gestureLocked = false,
  testId = "explore-pager",
}: ExplorePagerV2Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const gestureStateRef = useRef<ExplorePagerGestureState>(createIdleGestureState());
  const resetTimerRef = useRef<number | null>(null);
  const snapTimerRef = useRef<number | null>(null);
  const [viewportHeight, setViewportHeight] = useState(() => {
    if (typeof window === "undefined") return 1;
    return Math.max(1, window.innerHeight ?? 1);
  });
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const activeIndexRef = useRef(activeIndex);
  const totalSlidesRef = useRef(totalSlides);
  const isSnappingRef = useRef(false);
  const gestureLockedRef = useRef(gestureLocked);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    totalSlidesRef.current = totalSlides;
  }, [totalSlides]);

  useEffect(() => {
    isSnappingRef.current = isSnapping;
  }, [isSnapping]);

  useEffect(() => {
    gestureLockedRef.current = gestureLocked;
  }, [gestureLocked]);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current === null) return;
    window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
  }, []);

  const clearSnapTimer = useCallback(() => {
    if (snapTimerRef.current === null) return;
    window.clearTimeout(snapTimerRef.current);
    snapTimerRef.current = null;
  }, []);

  const clearAllTimers = useCallback(() => {
    clearResetTimer();
    clearSnapTimer();
  }, [clearResetTimer, clearSnapTimer]);

  const resetGestureState = useCallback(() => {
    gestureStateRef.current = createIdleGestureState();
    clearResetTimer();
  }, [clearResetTimer]);

  const scheduleSafetyReset = useCallback(() => {
    clearResetTimer();
    resetTimerRef.current = window.setTimeout(() => {
      setDragOffsetPx(0);
      setIsSnapping(false);
      resetGestureState();
    }, EXPLORE_PAGER_V2_RESET_TIMEOUT_MS);
  }, [clearResetTimer, resetGestureState]);

  const refreshViewportHeight = useCallback(() => {
    const next = Math.max(1, rootRef.current?.clientHeight ?? window.innerHeight ?? 1);
    setViewportHeight(next);
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
      }, EXPLORE_PAGER_V2_SNAP_DURATION_MS);
    },
    [clearSnapTimer, onActiveIndexChange]
  );

  const resetFromExitPath = useCallback(() => {
    const gestureState = gestureStateRef.current;
    if (!gestureState.active) {
      clearResetTimer();
      return;
    }
    if (gestureState.axis !== "vertical") {
      resetGestureState();
      return;
    }
    const currentIndex = activeIndexRef.current;
    const total = totalSlidesRef.current;
    const nextIndex = resolveExplorePagerV2NextIndex({
      activeIndex: currentIndex,
      totalSlides: total,
      deltaY: gestureState.deltaY,
      velocityY: gestureState.velocityY,
      viewportHeight,
    });
    const direction = Math.sign(nextIndex - currentIndex);
    if (direction === 0) {
      snapToOffset(0, null);
    } else {
      snapToOffset(direction < 0 ? viewportHeight : -viewportHeight, nextIndex);
    }
    resetGestureState();
  }, [clearResetTimer, resetGestureState, snapToOffset, viewportHeight]);

  const beginGesture = useCallback((x: number, y: number, timestamp: number) => {
    if (isSnappingRef.current) return;
    const nextState = createIdleGestureState();
    nextState.active = true;
    nextState.startX = x;
    nextState.startY = y;
    nextState.lastY = y;
    nextState.lastTimestamp = timestamp;
    gestureStateRef.current = nextState;
    setDragOffsetPx(0);
    scheduleSafetyReset();
  }, [scheduleSafetyReset]);

  const updateGesture = useCallback((x: number, y: number, timestamp: number) => {
    const gestureState = gestureStateRef.current;
    if (!gestureState.active || isSnappingRef.current) return;

    const deltaX = x - gestureState.startX;
    const deltaY = y - gestureState.startY;

    if (gestureState.axis === null) {
      gestureState.axis = resolveExplorePagerV2Axis(deltaX, deltaY);
    }
    if (gestureState.axis === null) return;

    if (gestureLockedRef.current) {
      gestureState.axis = "horizontal";
      setDragOffsetPx(0);
      scheduleSafetyReset();
      return;
    }

    if (gestureState.axis === "horizontal") {
      setDragOffsetPx(0);
      scheduleSafetyReset();
      return;
    }

    const deltaTimeMs = Math.max(1, timestamp - gestureState.lastTimestamp);
    gestureState.velocityY = (y - gestureState.lastY) / deltaTimeMs;
    gestureState.lastY = y;
    gestureState.lastTimestamp = timestamp;
    gestureState.deltaY = deltaY;

    const currentIndex = activeIndexRef.current;
    const hasPrevious = currentIndex > 0;
    const hasNext = currentIndex < totalSlidesRef.current - 1;
    const isAtBoundary = (deltaY > 0 && !hasPrevious) || (deltaY < 0 && !hasNext);
    const adjustedDelta = isAtBoundary ? deltaY * 0.35 : deltaY;
    const clampedDelta = clamp(adjustedDelta, -viewportHeight * 0.95, viewportHeight * 0.95);
    setDragOffsetPx(clampedDelta);
    scheduleSafetyReset();
  }, [scheduleSafetyReset, viewportHeight]);

  const windowedIndexes = useMemo(() => {
    const candidates = [activeIndex - 1, activeIndex, activeIndex + 1];
    return candidates.filter((index) => index >= 0 && index < totalSlides);
  }, [activeIndex, totalSlides]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const resetFromVisibility = () => {
      if (document.visibilityState !== "visible") {
        resetFromExitPath();
      }
    };
    window.addEventListener("pointerup", resetFromExitPath, { passive: true });
    window.addEventListener("pointercancel", resetFromExitPath, { passive: true });
    window.addEventListener("touchend", resetFromExitPath, { passive: true });
    window.addEventListener("touchcancel", resetFromExitPath, { passive: true });
    window.addEventListener("blur", resetFromExitPath, { passive: true });
    document.addEventListener("visibilitychange", resetFromVisibility, { passive: true });
    return () => {
      window.removeEventListener("pointerup", resetFromExitPath);
      window.removeEventListener("pointercancel", resetFromExitPath);
      window.removeEventListener("touchend", resetFromExitPath);
      window.removeEventListener("touchcancel", resetFromExitPath);
      window.removeEventListener("blur", resetFromExitPath);
      document.removeEventListener("visibilitychange", resetFromVisibility);
    };
  }, [resetFromExitPath]);

  useEffect(() => {
    return () => {
      clearAllTimers();
      resetGestureState();
      setDragOffsetPx(0);
      setIsSnapping(false);
    };
  }, [clearAllTimers, resetGestureState]);

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
      style={{
        touchAction: "pan-y pinch-zoom",
        overscrollBehaviorY: "contain",
      }}
      onPointerDownCapture={(event) => {
        if (event.pointerType === "touch") return;
        beginGesture(event.clientX, event.clientY, event.timeStamp);
      }}
      onPointerMoveCapture={(event) => {
        if (event.pointerType === "touch") return;
        updateGesture(event.clientX, event.clientY, event.timeStamp);
      }}
      onPointerUpCapture={resetFromExitPath}
      onPointerCancelCapture={resetFromExitPath}
      onTouchStartCapture={(event) => {
        const touch = event.touches[0];
        if (!touch) return;
        beginGesture(touch.clientX, touch.clientY, event.timeStamp);
      }}
      onTouchMoveCapture={(event) => {
        const touch = event.touches[0];
        if (!touch) return;
        const gestureState = gestureStateRef.current;
        if (gestureState.axis === "vertical") {
          event.preventDefault();
        }
        updateGesture(touch.clientX, touch.clientY, event.timeStamp);
      }}
      onTouchEndCapture={resetFromExitPath}
      onTouchCancelCapture={resetFromExitPath}
    >
      <div className="absolute inset-0" data-testid="explore-pager-v2-track">
        {windowedIndexes.map((index) => {
          const key = resolveSlideKey?.(index) ?? String(index);
          const offsetPx = (index - activeIndex) * viewportHeight + dragOffsetPx;
          return (
            <div
              key={`${index}:${key}`}
              className="absolute inset-0 will-change-transform"
              style={{
                transform: `translate3d(0, ${offsetPx}px, 0)`,
                transition: isSnapping
                  ? `transform ${EXPLORE_PAGER_V2_SNAP_DURATION_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
                  : "none",
              }}
            >
              {renderSlide(index)}
            </div>
          );
        })}
      </div>
    </div>
  );
});
