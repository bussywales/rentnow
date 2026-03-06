"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { glassSurface } from "@/lib/ui/glass";

export const GLASS_TOOLTIP_LONG_PRESS_MS = 350;
export const GLASS_TOOLTIP_MOBILE_AUTO_DISMISS_MS = 2200;

type GlassTooltipProps = {
  content: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  tooltipClassName?: string;
  testId?: string;
};

type LongPressTimers = {
  pressTimer: ReturnType<typeof setTimeout> | null;
  dismissTimer: ReturnType<typeof setTimeout> | null;
};

export function shouldEnableGlassTooltip(input: { disabled?: boolean; content: string; isTruncated: boolean }): boolean {
  return !input.disabled && input.isTruncated && input.content.trim().length > 0;
}

export function GlassTooltip({
  content,
  children,
  disabled = false,
  className,
  tooltipClassName,
  testId = "glass-tooltip",
}: GlassTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openedByLongPress, setOpenedByLongPress] = useState(false);
  const pressStateRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const timersRef = useRef<LongPressTimers>({ pressTimer: null, dismissTimer: null });

  const clearTimers = () => {
    if (timersRef.current.pressTimer) {
      clearTimeout(timersRef.current.pressTimer);
      timersRef.current.pressTimer = null;
    }
    if (timersRef.current.dismissTimer) {
      clearTimeout(timersRef.current.dismissTimer);
      timersRef.current.dismissTimer = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  const tooltipId = useMemo(
    () => `${testId}-content-${content.replace(/\s+/g, "-").toLowerCase().slice(0, 24) || "value"}`,
    [content, testId]
  );

  useEffect(() => {
    if (!openedByLongPress || !isOpen) return;
    const handleScroll = () => {
      setIsOpen(false);
      setOpenedByLongPress(false);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isOpen, openedByLongPress]);

  if (disabled) {
    return <span className={cn("block min-w-0", className)}>{children}</span>;
  }

  const openFromLongPress = () => {
    setOpenedByLongPress(true);
    setIsOpen(true);
    if (timersRef.current.dismissTimer) {
      clearTimeout(timersRef.current.dismissTimer);
    }
    timersRef.current.dismissTimer = setTimeout(() => {
      setIsOpen(false);
      setOpenedByLongPress(false);
      timersRef.current.dismissTimer = null;
    }, GLASS_TOOLTIP_MOBILE_AUTO_DISMISS_MS);
  };

  const handlePointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.pointerType !== "touch") return;
    pressStateRef.current = { x: event.clientX, y: event.clientY, moved: false };
    clearTimers();
    timersRef.current.pressTimer = setTimeout(() => {
      const state = pressStateRef.current;
      if (!state || state.moved) return;
      openFromLongPress();
    }, GLASS_TOOLTIP_LONG_PRESS_MS);
  };

  const handlePointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    const state = pressStateRef.current;
    if (!state) return;
    const dx = Math.abs(event.clientX - state.x);
    const dy = Math.abs(event.clientY - state.y);
    if (dx > 10 || dy > 10) {
      state.moved = true;
      if (timersRef.current.pressTimer) {
        clearTimeout(timersRef.current.pressTimer);
        timersRef.current.pressTimer = null;
      }
    }
  };

  const handlePointerUpOrCancel = () => {
    if (timersRef.current.pressTimer) {
      clearTimeout(timersRef.current.pressTimer);
      timersRef.current.pressTimer = null;
    }
    pressStateRef.current = null;
  };

  return (
    <span
      className={cn("relative block min-w-0", className)}
      onMouseEnter={() => {
        if (openedByLongPress) return;
        setIsOpen(true);
      }}
      onMouseLeave={() => {
        if (openedByLongPress) return;
        setIsOpen(false);
      }}
      onFocus={() => {
        setOpenedByLongPress(false);
        setIsOpen(true);
      }}
      onBlur={() => {
        setOpenedByLongPress(false);
        setIsOpen(false);
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      data-testid={`${testId}-anchor`}
    >
      <span aria-describedby={isOpen ? tooltipId : undefined}>{children}</span>
      {isOpen ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            glassSurface(
              "pointer-events-none absolute bottom-full left-0 z-40 mb-1.5 max-w-[80vw] rounded-2xl px-3 py-1.5 text-xs font-medium leading-snug text-white"
            ),
            tooltipClassName
          )}
          data-testid={testId}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
