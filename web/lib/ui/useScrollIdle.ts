"use client";

import { useEffect, useRef, useState } from "react";

type UseScrollIdleOptions = {
  idleMs?: number;
};

type ScrollIdleControllerInput = {
  idleMs: number;
  onChange: (isScrolling: boolean) => void;
  setTimer?: (callback: () => void, timeoutMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
};

type ScrollIdleController = {
  markActivity: () => void;
  dispose: () => void;
  isScrolling: () => boolean;
};

export const DEFAULT_SCROLL_IDLE_MS = 140;

export function resolveScrollIdleActive(input: {
  lastActivityAtMs: number | null;
  nowMs: number;
  idleMs: number;
}): boolean {
  if (input.lastActivityAtMs === null) return false;
  return input.nowMs - input.lastActivityAtMs < Math.max(0, input.idleMs);
}

export function createScrollIdleController(input: ScrollIdleControllerInput): ScrollIdleController {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let scrolling = false;
  const setTimer = input.setTimer ?? ((callback, timeoutMs) => globalThis.setTimeout(callback, timeoutMs));
  const clearTimer = input.clearTimer ?? ((nextTimer) => globalThis.clearTimeout(nextTimer));

  const markScrolling = () => {
    if (scrolling) return;
    scrolling = true;
    input.onChange(true);
  };

  const markIdle = () => {
    if (!scrolling) return;
    scrolling = false;
    input.onChange(false);
  };

  const resetTimer = () => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    timer = setTimer(() => {
      timer = null;
      markIdle();
    }, Math.max(0, input.idleMs));
  };

  return {
    markActivity: () => {
      markScrolling();
      resetTimer();
    },
    dispose: () => {
      if (timer !== null) {
        clearTimer(timer);
        timer = null;
      }
      markIdle();
    },
    isScrolling: () => scrolling,
  };
}

export function useScrollIdle(options: UseScrollIdleOptions = {}) {
  const idleMs = options.idleMs ?? DEFAULT_SCROLL_IDLE_MS;
  const [isScrolling, setIsScrolling] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const controller = createScrollIdleController({
      idleMs,
      onChange: setIsScrolling,
    });

    const onScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        controller.markActivity();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      controller.dispose();
    };
  }, [idleMs]);

  return { isScrolling };
}
