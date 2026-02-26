"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { focusFirstTarget, trapFocusWithinContainer } from "@/lib/a11y/focus";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  testId?: string;
  sheetId?: string;
};

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  testId = "bottom-sheet",
  sheetId,
}: BottomSheetProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const rafId = window.requestAnimationFrame(() => {
      focusFirstTarget(panelRef.current);
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      trapFocusWithinContainer(event, panelRef.current);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(rafId);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end md:hidden" data-testid={testId}>
      <button
        type="button"
        aria-label="Close sheet"
        className="absolute inset-0 bg-slate-900/45"
        onClick={() => onOpenChange(false)}
        data-testid="bottom-sheet-backdrop"
      />
      <div
        id={sheetId}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        data-testid="bottom-sheet-panel"
        className={cn(
          "relative flex max-h-[calc(100svh-0.5rem)] w-full flex-col overflow-hidden rounded-t-3xl border-t border-slate-200 bg-white p-4 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-[0_-16px_48px_rgba(15,23,42,0.18)] outline-none transition-transform motion-reduce:transition-none",
          className
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-xs text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-600"
            aria-label="Close"
            data-testid="bottom-sheet-close"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}
