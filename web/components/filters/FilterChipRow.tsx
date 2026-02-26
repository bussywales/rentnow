"use client";

import Link from "next/link";

export type FilterChipItem = {
  id: string;
  label: string;
  value?: string;
  onRemove?: () => void;
};

type FilterChipRowProps = {
  chips: FilterChipItem[];
  clearLabel?: string;
  clearHref?: string;
  onClear?: () => void;
  className?: string;
  maxVisible?: number;
  testId?: string;
};

export function FilterChipRow({
  chips,
  clearLabel = "Clear",
  clearHref,
  onClear,
  className,
  maxVisible = 3,
  testId = "filters-chip-row",
}: FilterChipRowProps) {
  if (chips.length === 0) return null;

  const visible = chips.slice(0, maxVisible);
  const hiddenCount = Math.max(0, chips.length - visible.length);
  const showClear = Boolean(onClear || clearHref);

  return (
    <div
      className={`flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap rounded-2xl border border-slate-200 bg-white/80 p-2.5 text-xs text-slate-700 shadow-sm ${className ?? ""}`.trim()}
      data-testid={testId}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Active filters</p>
      {visible.map((chip) => {
        const label = chip.value ? `${chip.label}: ${chip.value}` : chip.label;
        if (!chip.onRemove) {
          return (
            <span
              key={chip.id}
              className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
              data-testid="filters-chip"
            >
              {label}
            </span>
          );
        }

        return (
          <button
            key={chip.id}
            type="button"
            onClick={chip.onRemove}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
            title={`Remove ${label}`}
            data-testid="filters-chip"
          >
            <span>{label}</span>
            <span aria-hidden="true">×</span>
          </button>
        );
      })}
      {hiddenCount > 0 ? <span className="truncate text-xs text-slate-500">+{hiddenCount} more</span> : null}
      {showClear ? (
        onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:border-sky-100"
            data-testid="filters-clear"
          >
            {clearLabel}
          </button>
        ) : (
          <Link
            href={clearHref || "#"}
            className="rounded-full border border-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:border-sky-100"
            data-testid="filters-clear"
          >
            {clearLabel}
          </Link>
        )
      ) : null}
    </div>
  );
}
