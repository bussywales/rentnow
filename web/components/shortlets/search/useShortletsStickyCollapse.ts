"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type StickyCollapseStateInput = {
  scrollY: number;
  previousScrollY: number;
  currentlyCollapsed: boolean;
  isMobileViewport: boolean;
  lockExpanded: boolean;
  nearTopPx: number;
  collapseAfterPx: number;
  expandBeforePx: number;
  directionThresholdPx: number;
};

type StickyCollapseOptions = {
  enabled: boolean;
  lockExpanded?: boolean;
  nearTopPx?: number;
  collapseAfterPx?: number;
  expandBeforePx?: number;
  directionThresholdPx?: number;
  mobileMaxWidthPx?: number;
};

export function resolveShortletsStickyCollapsedState(input: StickyCollapseStateInput): boolean {
  const safeScrollY = Number.isFinite(input.scrollY) ? Math.max(0, input.scrollY) : 0;
  if (!input.isMobileViewport || input.lockExpanded) return false;
  if (safeScrollY < input.nearTopPx || safeScrollY < input.expandBeforePx) return false;

  const delta = safeScrollY - input.previousScrollY;
  if (Math.abs(delta) < input.directionThresholdPx) return input.currentlyCollapsed;
  if (delta > 0 && safeScrollY >= input.collapseAfterPx) return true;
  if (delta < 0) return false;
  return input.currentlyCollapsed;
}

export function useShortletsStickyCollapse(options: StickyCollapseOptions): {
  isCollapsed: boolean;
  forceExpand: () => void;
} {
  const {
    enabled,
    lockExpanded = false,
    nearTopPx = 40,
    collapseAfterPx = 200,
    expandBeforePx = 120,
    directionThresholdPx = 12,
    mobileMaxWidthPx = 1023,
  } = options;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const lastScrollYRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const forceExpand = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const media = window.matchMedia(`(max-width: ${mobileMaxWidthPx}px)`);

    const applyScrollState = () => {
      const nextScrollY = Math.max(0, window.scrollY || 0);
      setIsCollapsed((current) =>
        resolveShortletsStickyCollapsedState({
          scrollY: nextScrollY,
          previousScrollY: lastScrollYRef.current,
          currentlyCollapsed: current,
          isMobileViewport: media.matches,
          lockExpanded,
          nearTopPx,
          collapseAfterPx,
          expandBeforePx,
          directionThresholdPx,
        })
      );
      lastScrollYRef.current = nextScrollY;
      rafRef.current = null;
    };

    const onScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(applyScrollState);
    };

    const onViewportChange = () => {
      if (!media.matches) {
        setIsCollapsed(false);
      }
      lastScrollYRef.current = Math.max(0, window.scrollY || 0);
    };

    lastScrollYRef.current = Math.max(0, window.scrollY || 0);
    applyScrollState();

    window.addEventListener("scroll", onScroll, { passive: true });
    media.addEventListener("change", onViewportChange);

    return () => {
      window.removeEventListener("scroll", onScroll);
      media.removeEventListener("change", onViewportChange);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [
    enabled,
    lockExpanded,
    nearTopPx,
    collapseAfterPx,
    expandBeforePx,
    directionThresholdPx,
    mobileMaxWidthPx,
  ]);

  return {
    isCollapsed: enabled && !lockExpanded ? isCollapsed : false,
    forceExpand,
  };
}
