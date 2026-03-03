"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

export const EXPLORE_PAGER_V3_AXIS_THRESHOLD_PX = 10;
export const EXPLORE_PAGER_V3_SWIPE_DISTANCE_RATIO = 0.16;
export const EXPLORE_PAGER_V3_MIN_SWIPE_DISTANCE_PX = 56;
export const EXPLORE_PAGER_V3_SWIPE_VELOCITY_THRESHOLD = 0.45;
export const EXPLORE_PAGER_V3_SNAP_DURATION_MS = 220;
export const EXPLORE_PAGER_V3_RESET_TIMEOUT_MS = 600;
export const EXPLORE_PAGER_V3_BLOCKED_CUE_DURATION_MS = 900;

export type ExplorePagerV3Axis = "horizontal" | "vertical" | null;

type ExplorePagerV3Props = {
  totalSlides: number;
  activeIndex: number;
  onActiveIndexChange: (nextIndex: number) => void;
  renderSlide: (index: number) => ReactNode;
  resolveSlideKey?: (index: number) => string;
  gestureLocked?: boolean;
  canAdvanceToIndex?: (index: number) => boolean;
  testId?: string;
};

type ExplorePagerV3GestureState = {
  active: boolean;
  activePointerId: number | null;
  axis: ExplorePagerV3Axis;
  startX: number;
  startY: number;
  lastY: number;
  lastTimestamp: number;
  deltaY: number;
  velocityY: number;
  ignoreVertical: boolean;
};

type ExplorePagerV3Slot = {
  name: "prev" | "current" | "next";
  index: number;
  slotOffset: -1 | 0 | 1;
};

function createIdleGestureState(): ExplorePagerV3GestureState {
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
    ignoreVertical: false,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resolveExplorePagerV3Axis(
  deltaX: number,
  deltaY: number,
  threshold = EXPLORE_PAGER_V3_AXIS_THRESHOLD_PX
): ExplorePagerV3Axis {
  if (Math.abs(deltaX) < threshold && Math.abs(deltaY) < threshold) return null;
  if (Math.abs(deltaX) > Math.abs(deltaY)) return "horizontal";
  return "vertical";
}

export function resolveExplorePagerV3Slots(activeIndex: number, totalSlides: number): ExplorePagerV3Slot[] {
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

export function resolveExplorePagerV3Release(input: {
  activeIndex: number;
  totalSlides: number;
  deltaY: number;
  velocityY: number;
  viewportHeight: number;
  canAdvanceToIndex?: (index: number) => boolean;
}): {
  nextIndex: number;
  blocked: boolean;
} {
  if (input.totalSlides <= 1) {
    return { nextIndex: 0, blocked: false };
  }

  const distanceThreshold = Math.max(
    EXPLORE_PAGER_V3_MIN_SWIPE_DISTANCE_PX,
    input.viewportHeight * EXPLORE_PAGER_V3_SWIPE_DISTANCE_RATIO
  );
  const shouldAdvanceByDistance = Math.abs(input.deltaY) >= distanceThreshold;
  const shouldAdvanceByVelocity = Math.abs(input.velocityY) >= EXPLORE_PAGER_V3_SWIPE_VELOCITY_THRESHOLD;
  if (!shouldAdvanceByDistance && !shouldAdvanceByVelocity) {
    return { nextIndex: input.activeIndex, blocked: false };
  }

  let candidateIndex = input.activeIndex;
  if (input.deltaY < 0 || input.velocityY < 0) {
    candidateIndex = Math.min(input.totalSlides - 1, input.activeIndex + 1);
  } else {
    candidateIndex = Math.max(0, input.activeIndex - 1);
  }

  if (candidateIndex !== input.activeIndex && input.canAdvanceToIndex && !input.canAdvanceToIndex(candidateIndex)) {
    return {
      nextIndex: input.activeIndex,
      blocked: true,
    };
  }

  return {
    nextIndex: candidateIndex,
    blocked: false,
  };
}

export const ExplorePagerV3 = memo(function ExplorePagerV3({
  totalSlides,
  activeIndex,
  onActiveIndexChange,
  renderSlide,
  resolveSlideKey,
  gestureLocked = false,
  canAdvanceToIndex,
  testId = "explore-pager",
}: ExplorePagerV3Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const gestureStateRef = useRef<ExplorePagerV3GestureState>(createIdleGestureState());
  const resetTimerRef = useRef<number | null>(null);
  const snapTimerRef = useRef<number | null>(null);
  const blockedCueTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingOffsetRef = useRef(0);
  const activeIndexRef = useRef(activeIndex);
  const totalSlidesRef = useRef(totalSlides);
  const isSnappingRef = useRef(false);

  const [viewportHeight, setViewportHeight] = useState(() => {
    if (typeof window === "undefined") return 1;
    return Math.max(1, window.innerHeight ?? 1);
  });
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const [showBlockedAdvanceCue, setShowBlockedAdvanceCue] = useState(false);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    totalSlidesRef.current = totalSlides;
  }, [totalSlides]);

  useEffect(() => {
    isSnappingRef.current = isSnapping;
  }, [isSnapping]);

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

  const clearBlockedCueTimer = useCallback(() => {
    if (blockedCueTimerRef.current === null) return;
    window.clearTimeout(blockedCueTimerRef.current);
    blockedCueTimerRef.current = null;
  }, []);

  const clearRaf = useCallback(() => {
    if (rafRef.current === null) return;
    window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const clearAllTimers = useCallback(() => {
    clearResetTimer();
    clearSnapTimer();
    clearBlockedCueTimer();
  }, [clearBlockedCueTimer, clearResetTimer, clearSnapTimer]);

  const setDragOffsetWithRaf = useCallback((nextOffset: number) => {
    if (typeof window === "undefined") {
      setDragOffsetPx(nextOffset);
      return;
    }
    pendingOffsetRef.current = nextOffset;
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      setDragOffsetPx(pendingOffsetRef.current);
    });
  }, []);

  const resetGestureState = useCallback(() => {
    gestureStateRef.current = createIdleGestureState();
    clearResetTimer();
  }, [clearResetTimer]);

  const hardResetGestureState = useCallback(() => {
    clearSnapTimer();
    clearRaf();
    resetGestureState();
    setIsSnapping(false);
    setDragOffsetPx(0);
    pendingOffsetRef.current = 0;
  }, [clearRaf, clearSnapTimer, resetGestureState]);

  const scheduleSafetyReset = useCallback(() => {
    clearResetTimer();
    resetTimerRef.current = window.setTimeout(() => {
      hardResetGestureState();
    }, EXPLORE_PAGER_V3_RESET_TIMEOUT_MS);
  }, [clearResetTimer, hardResetGestureState]);

  const showBlockedCue = useCallback(() => {
    setShowBlockedAdvanceCue(true);
    clearBlockedCueTimer();
    blockedCueTimerRef.current = window.setTimeout(() => {
      setShowBlockedAdvanceCue(false);
    }, EXPLORE_PAGER_V3_BLOCKED_CUE_DURATION_MS);
  }, [clearBlockedCueTimer]);

  const refreshViewportHeight = useCallback(() => {
    const next = Math.max(1, rootRef.current?.clientHeight ?? window.innerHeight ?? 1);
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
      setDragOffsetWithRaf(targetOffset);
      snapTimerRef.current = window.setTimeout(() => {
        if (nextIndex !== null) {
          onActiveIndexChange(nextIndex);
        }
        requestAnimationFrame(() => {
          setIsSnapping(false);
          setDragOffsetPx(0);
          pendingOffsetRef.current = 0;
        });
      }, EXPLORE_PAGER_V3_SNAP_DURATION_MS);
    },
    [clearSnapTimer, onActiveIndexChange, setDragOffsetWithRaf]
  );

  const finalizeGestureFromExitPath = useCallback(() => {
    const gestureState = gestureStateRef.current;
    if (!gestureState.active || gestureState.axis !== "vertical" || gestureState.ignoreVertical) {
      hardResetGestureState();
      return;
    }

    const release = resolveExplorePagerV3Release({
      activeIndex: activeIndexRef.current,
      totalSlides: totalSlidesRef.current,
      deltaY: gestureState.deltaY,
      velocityY: gestureState.velocityY,
      viewportHeight,
      canAdvanceToIndex,
    });
    if (release.blocked) {
      showBlockedCue();
    }

    const direction = Math.sign(release.nextIndex - activeIndexRef.current);
    if (direction === 0) {
      snapToOffset(0, null);
    } else {
      snapToOffset(direction < 0 ? viewportHeight : -viewportHeight, release.nextIndex);
    }
    resetGestureState();
  }, [canAdvanceToIndex, hardResetGestureState, resetGestureState, showBlockedCue, snapToOffset, viewportHeight]);

  const beginGesture = useCallback(
    (x: number, y: number, timestamp: number, pointerId: number | null = null) => {
      if (gestureLocked || isSnappingRef.current) return;
      const nextState = createIdleGestureState();
      nextState.active = true;
      nextState.activePointerId = pointerId;
      nextState.startX = x;
      nextState.startY = y;
      nextState.lastY = y;
      nextState.lastTimestamp = timestamp;
      gestureStateRef.current = nextState;
      setDragOffsetWithRaf(0);
      scheduleSafetyReset();
    },
    [gestureLocked, scheduleSafetyReset, setDragOffsetWithRaf]
  );

  const updateGesture = useCallback(
    (x: number, y: number, timestamp: number, pointerId: number | null = null) => {
      const gestureState = gestureStateRef.current;
      if (!gestureState.active || isSnappingRef.current) return;
      if (gestureState.activePointerId !== null && pointerId !== null && pointerId !== gestureState.activePointerId) {
        return;
      }
      if (gestureLocked) {
        hardResetGestureState();
        return;
      }

      const deltaX = x - gestureState.startX;
      const deltaY = y - gestureState.startY;
      if (gestureState.axis === null) {
        gestureState.axis = resolveExplorePagerV3Axis(deltaX, deltaY);
      }
      if (gestureState.axis === null) return;

      if (gestureState.axis === "horizontal") {
        gestureState.ignoreVertical = true;
        setDragOffsetWithRaf(0);
        scheduleSafetyReset();
        return;
      }
      if (gestureState.ignoreVertical) {
        setDragOffsetWithRaf(0);
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
      setDragOffsetWithRaf(clampedDelta);
      scheduleSafetyReset();
    },
    [gestureLocked, hardResetGestureState, scheduleSafetyReset, setDragOffsetWithRaf, viewportHeight]
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

    window.addEventListener("pointerup", finalizeGestureFromExitPath, { passive: true });
    window.addEventListener("pointercancel", finalizeGestureFromExitPath, { passive: true });
    window.addEventListener("touchend", finalizeGestureFromExitPath, { passive: true });
    window.addEventListener("touchcancel", finalizeGestureFromExitPath, { passive: true });
    window.addEventListener("blur", hardResetGestureState);
    document.addEventListener("visibilitychange", resetFromVisibility, { passive: true });
    return () => {
      window.removeEventListener("pointerup", finalizeGestureFromExitPath);
      window.removeEventListener("pointercancel", finalizeGestureFromExitPath);
      window.removeEventListener("touchend", finalizeGestureFromExitPath);
      window.removeEventListener("touchcancel", finalizeGestureFromExitPath);
      window.removeEventListener("blur", hardResetGestureState);
      document.removeEventListener("visibilitychange", resetFromVisibility);
    };
  }, [finalizeGestureFromExitPath, hardResetGestureState]);

  useEffect(() => {
    return () => {
      clearAllTimers();
      clearRaf();
      resetGestureState();
      setIsSnapping(false);
      setDragOffsetPx(0);
      pendingOffsetRef.current = 0;
      setShowBlockedAdvanceCue(false);
    };
  }, [clearAllTimers, clearRaf, resetGestureState]);

  const slots = useMemo(() => resolveExplorePagerV3Slots(activeIndex, totalSlides), [activeIndex, totalSlides]);

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
        beginGesture(event.clientX, event.clientY, event.timeStamp, event.pointerId);
      }}
      onPointerMoveCapture={(event) => {
        if (event.pointerType === "touch") return;
        updateGesture(event.clientX, event.clientY, event.timeStamp, event.pointerId);
      }}
      onPointerUpCapture={finalizeGestureFromExitPath}
      onPointerCancelCapture={finalizeGestureFromExitPath}
      onPointerLeave={hardResetGestureState}
      onTouchStartCapture={(event) => {
        const touch = event.touches[0];
        if (!touch) return;
        beginGesture(touch.clientX, touch.clientY, event.timeStamp);
      }}
      onTouchMoveCapture={(event) => {
        const touch = event.touches[0];
        if (!touch) return;
        updateGesture(touch.clientX, touch.clientY, event.timeStamp);
        if (gestureStateRef.current.axis === "vertical" && !gestureStateRef.current.ignoreVertical) {
          event.preventDefault();
        }
      }}
      onTouchEndCapture={finalizeGestureFromExitPath}
      onTouchCancelCapture={finalizeGestureFromExitPath}
    >
      <div className="absolute inset-0" data-testid="explore-pager-v3-track">
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
                  ? `transform ${EXPLORE_PAGER_V3_SNAP_DURATION_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
                  : "none",
                pointerEvents: slot.name === "current" ? "auto" : "none",
              }}
            >
              {isDuplicateOfCurrent ? <div className="h-full w-full bg-slate-950" aria-hidden /> : renderSlide(slot.index)}
            </div>
          );
        })}
      </div>
      {showBlockedAdvanceCue ? (
        <span
          className="pointer-events-none absolute left-3 top-9 z-20 rounded-full border border-white/30 bg-slate-900/65 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/90"
          data-testid={`${testId}-loading-next`}
          aria-live="polite"
        >
          Loading next...
        </span>
      ) : null}
    </div>
  );
});
