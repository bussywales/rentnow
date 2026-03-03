"use client";

import { useEffect, useRef, useState } from "react";

export type DebouncedVisibilityOptions = {
  showAfterMs?: number;
  minVisibleMs?: number;
};

export function useDebouncedVisibility(
  targetVisible: boolean,
  options: DebouncedVisibilityOptions = {}
): boolean {
  const showAfterMs = Math.max(0, Math.trunc(options.showAfterMs ?? 300));
  const minVisibleMs = Math.max(0, Math.trunc(options.minVisibleMs ?? 600));
  const [visible, setVisible] = useState(false);
  const visibleSinceRef = useRef<number>(0);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
      }
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
      showTimerRef.current = null;
      hideTimerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      setVisible(targetVisible);
      return;
    }

    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (targetVisible) {
      if (visible) return;
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
      }
      showTimerRef.current = window.setTimeout(() => {
        visibleSinceRef.current = Date.now();
        setVisible(true);
        showTimerRef.current = null;
      }, showAfterMs);
      return;
    }

    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (!visible) return;

    const elapsedVisibleMs = Math.max(0, Date.now() - visibleSinceRef.current);
    const remainingVisibleMs = Math.max(0, minVisibleMs - elapsedVisibleMs);
    if (remainingVisibleMs === 0) {
      setVisible(false);
      return;
    }
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      hideTimerRef.current = null;
    }, remainingVisibleMs);
  }, [minVisibleMs, showAfterMs, targetVisible, visible]);

  return visible;
}
