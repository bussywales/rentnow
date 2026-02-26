"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

type FilterDrawerShellProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onApply?: () => void;
  onReset?: () => void;
  onClear?: () => void;
  applyLabel?: string;
  resetLabel?: string;
  clearLabel?: string;
  drawerTestId?: string;
  overlayTestId?: string;
  ariaLabel?: string;
  hideActions?: boolean;
};

export function FilterDrawerShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  onApply,
  onReset,
  onClear,
  applyLabel = "Apply",
  resetLabel = "Reset",
  clearLabel = "Clear all",
  drawerTestId = "filters-drawer",
  overlayTestId = "filters-overlay",
  ariaLabel = "Filters",
  hideActions = false,
}: FilterDrawerShellProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close filters"
        className="fixed inset-0 z-40 bg-slate-900/30"
        onClick={onClose}
        data-testid={overlayTestId}
      />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end">
        <aside
          className="pointer-events-auto flex max-h-[86vh] w-full flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl md:h-full md:max-h-none md:w-[420px] md:rounded-none md:border-l md:border-t-0"
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          data-testid={drawerTestId}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
              aria-label="Close filters"
            >
              ×
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

          {!hideActions ? (
            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
              {onClear ? (
                <Button type="button" variant="secondary" onClick={onClear} data-testid="filters-clear">
                  {clearLabel}
                </Button>
              ) : null}
              {onReset ? (
                <Button type="button" variant="secondary" onClick={onReset} data-testid="filters-reset">
                  {resetLabel}
                </Button>
              ) : null}
              {onApply ? (
                <Button type="button" onClick={onApply} data-testid="filters-apply">
                  {applyLabel}
                </Button>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}
