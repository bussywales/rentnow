"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export const FLOATING_ACTION_RAIL_BASE_BOTTOM_OFFSET_PX = 88;
export const FLOATING_ACTION_RAIL_OVERLAP_GAP_PX = 12;

type FloatingActionRailProps = {
  children: ReactNode;
  className?: string;
  hidden?: boolean;
  hideWhenFormFocused?: boolean;
  avoidSelector?: string | null;
  baseBottomOffsetPx?: number;
  testId?: string;
};

type ResolveFloatingActionRailVisibilityInput = {
  hidden: boolean;
  hideWhenFormFocused: boolean;
  isFormFocused: boolean;
};

type ResolveFloatingActionRailOverlapLiftInput = {
  railRect: DOMRect;
  avoidRect: DOMRect;
  gapPx?: number;
};

export function resolveFloatingActionRailVisibility({
  hidden,
  hideWhenFormFocused,
  isFormFocused,
}: ResolveFloatingActionRailVisibilityInput): boolean {
  if (hidden) return false;
  if (!hideWhenFormFocused) return true;
  return !isFormFocused;
}

export function resolveFloatingActionRailBottomOffsetPx(input: {
  baseBottomOffsetPx: number;
  overlapLiftPx: number;
}): number {
  const baseOffset = Number.isFinite(input.baseBottomOffsetPx) ? input.baseBottomOffsetPx : 0;
  const overlapLift = Number.isFinite(input.overlapLiftPx) ? input.overlapLiftPx : 0;
  return Math.max(0, Math.round(baseOffset + overlapLift));
}

export function resolveFloatingActionRailOverlapLift({
  railRect,
  avoidRect,
  gapPx = FLOATING_ACTION_RAIL_OVERLAP_GAP_PX,
}: ResolveFloatingActionRailOverlapLiftInput): number {
  const horizontalOverlap = Math.min(railRect.right, avoidRect.right) - Math.max(railRect.left, avoidRect.left);
  if (horizontalOverlap <= 0) return 0;

  const expandedAvoidTop = avoidRect.top - gapPx;
  const expandedAvoidBottom = avoidRect.bottom + gapPx;
  const verticalOverlap = Math.min(railRect.bottom, expandedAvoidBottom) - Math.max(railRect.top, expandedAvoidTop);
  if (verticalOverlap <= 0) return 0;

  const liftPx = railRect.bottom - expandedAvoidTop;
  return Math.max(0, Math.ceil(liftPx));
}

function isEditableFormTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const focusableFormSelector =
    "input, textarea, select, [role='textbox'], [role='searchbox'], [role='combobox'], [role='spinbutton']";
  if (target.matches(focusableFormSelector)) return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest(`${focusableFormSelector}, [contenteditable='true']`));
}

function isVisibleElement(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (!element.isConnected) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function FloatingActionRail({
  children,
  className,
  hidden = false,
  hideWhenFormFocused = true,
  avoidSelector = null,
  baseBottomOffsetPx = FLOATING_ACTION_RAIL_BASE_BOTTOM_OFFSET_PX,
  testId,
}: FloatingActionRailProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [isFormFocused, setIsFormFocused] = useState(() =>
    typeof document !== "undefined" ? isEditableFormTarget(document.activeElement) : false
  );
  const [overlapLiftPx, setOverlapLiftPx] = useState(0);

  const isVisible = useMemo(
    () =>
      resolveFloatingActionRailVisibility({
        hidden,
        hideWhenFormFocused,
        isFormFocused,
      }),
    [hidden, hideWhenFormFocused, isFormFocused]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;

    const onFocusIn = (event: FocusEvent) => {
      setIsFormFocused(isEditableFormTarget(event.target));
    };

    const onFocusOut = () => {
      window.setTimeout(() => {
        setIsFormFocused(isEditableFormTarget(document.activeElement));
      }, 0);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!avoidSelector || !isVisible) return;

    let rafId: number | null = null;
    let mutationObserver: MutationObserver | null = null;
    const scheduleMeasure = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const rail = railRef.current;
        if (!rail || !isVisible) {
          setOverlapLiftPx(0);
          return;
        }

        const avoidElements = Array.from(document.querySelectorAll(avoidSelector)).filter(isVisibleElement);
        if (avoidElements.length === 0) {
          setOverlapLiftPx(0);
          return;
        }

        const railRect = rail.getBoundingClientRect();
        let nextLiftPx = 0;
        avoidElements.forEach((element) => {
          nextLiftPx = Math.max(
            nextLiftPx,
            resolveFloatingActionRailOverlapLift({
              railRect,
              avoidRect: element.getBoundingClientRect(),
            })
          );
        });
        setOverlapLiftPx(nextLiftPx);
      });
    };

    scheduleMeasure();
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, { passive: true });
    if (typeof MutationObserver !== "undefined" && document.body) {
      mutationObserver = new MutationObserver(() => {
        scheduleMeasure();
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true });
    }

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure);
    };
  }, [avoidSelector, isVisible]);

  const effectiveOverlapLiftPx = avoidSelector && isVisible ? overlapLiftPx : 0;
  const bottomOffsetPx = resolveFloatingActionRailBottomOffsetPx({
    baseBottomOffsetPx,
    overlapLiftPx: effectiveOverlapLiftPx,
  });

  return (
    <div
      ref={railRef}
      className={cn(
        "fixed right-4 z-[35] flex flex-col items-end gap-2 transition-opacity duration-200 ease-out motion-reduce:transition-none sm:right-6",
        isVisible ? "pointer-events-auto visible opacity-100" : "pointer-events-none invisible opacity-0",
        className
      )}
      style={{
        bottom: `calc(env(safe-area-inset-bottom, 0px) + ${bottomOffsetPx}px)`,
      }}
      data-form-focused={isFormFocused ? "true" : "false"}
      data-overlap-lift={String(effectiveOverlapLiftPx)}
      data-testid={testId}
      aria-hidden={isVisible ? undefined : true}
    >
      {children}
    </div>
  );
}
