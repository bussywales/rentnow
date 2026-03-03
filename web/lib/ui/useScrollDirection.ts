"use client";

import { useEffect, useRef, useState } from "react";

export type ScrollDirection = "up" | "down" | "idle";

type ScrollDirectionState = {
  direction: ScrollDirection;
  velocity: number;
  isNearBottomNavSafeZone: boolean;
  scrollY: number;
};

type ResolveScrollDirectionInput = {
  previousY: number;
  nextY: number;
  previousDirection: ScrollDirection;
  collapseThresholdPx: number;
  expandThresholdPx: number;
  nearTopPx: number;
};

type UseScrollDirectionOptions = {
  collapseThresholdPx?: number;
  expandThresholdPx?: number;
  nearTopPx?: number;
};

export const DEFAULT_SCROLL_COLLAPSE_THRESHOLD_PX = 14;
export const DEFAULT_SCROLL_EXPAND_THRESHOLD_PX = 8;
export const DEFAULT_SCROLL_NEAR_TOP_PX = 48;

const INITIAL_STATE: ScrollDirectionState = {
  direction: "idle",
  velocity: 0,
  isNearBottomNavSafeZone: true,
  scrollY: 0,
};

function readWindowScrollY() {
  if (typeof window === "undefined") return 0;
  return Math.max(0, window.scrollY || 0);
}

export function resolveScrollDirection(input: ResolveScrollDirectionInput): ScrollDirection {
  if (input.nextY <= input.nearTopPx) return "up";
  const delta = input.nextY - input.previousY;
  if (delta >= input.collapseThresholdPx) return "down";
  if (delta <= -Math.abs(input.expandThresholdPx)) return "up";
  return input.previousDirection;
}

export function useScrollDirection(options: UseScrollDirectionOptions = {}): ScrollDirectionState {
  const collapseThresholdPx = options.collapseThresholdPx ?? DEFAULT_SCROLL_COLLAPSE_THRESHOLD_PX;
  const expandThresholdPx = options.expandThresholdPx ?? DEFAULT_SCROLL_EXPAND_THRESHOLD_PX;
  const nearTopPx = options.nearTopPx ?? DEFAULT_SCROLL_NEAR_TOP_PX;
  const [state, setState] = useState<ScrollDirectionState>(INITIAL_STATE);
  const lastYRef = useRef(0);
  const lastTsRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyScrollFrame = () => {
      const now = Date.now();
      const nextY = readWindowScrollY();
      const previousY = lastYRef.current;
      const delta = nextY - previousY;
      const elapsedMs = Math.max(16, now - (lastTsRef.current || now));
      const velocity = Math.abs(delta) / elapsedMs;
      lastYRef.current = nextY;
      lastTsRef.current = now;
      setState((previous) => {
        const direction = resolveScrollDirection({
          previousY,
          nextY,
          previousDirection: previous.direction,
          collapseThresholdPx,
          expandThresholdPx,
          nearTopPx,
        });
        const isNearBottomNavSafeZone = nextY <= nearTopPx;
        if (
          previous.direction === direction &&
          Math.abs(previous.velocity - velocity) < 0.02 &&
          previous.isNearBottomNavSafeZone === isNearBottomNavSafeZone &&
          previous.scrollY === nextY
        ) {
          return previous;
        }
        return {
          direction,
          velocity,
          isNearBottomNavSafeZone,
          scrollY: nextY,
        };
      });
      rafRef.current = null;
    };

    const onScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(applyScrollFrame);
    };

    lastYRef.current = readWindowScrollY();
    lastTsRef.current = Date.now();
    applyScrollFrame();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [collapseThresholdPx, expandThresholdPx, nearTopPx]);

  return state;
}
