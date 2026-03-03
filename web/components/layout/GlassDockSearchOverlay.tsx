"use client";

import { useEffect, useRef } from "react";
import { GlassPill } from "@/components/ui/GlassPill";
import { cn } from "@/components/ui/cn";

type GlassDockSearchOverlayProps = {
  open: boolean;
  query: string;
  nearMe: boolean;
  onQueryChange: (value: string) => void;
  onToggleNearMe: () => void;
  onReset: () => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function GlassDockSearchOverlay({
  open,
  query,
  nearMe,
  onQueryChange,
  onToggleNearMe,
  onReset,
  onClose,
  onSubmit,
}: GlassDockSearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  return (
    <>
      <button
        type="button"
        aria-label="Close dock search"
        onClick={onClose}
        hidden={!open}
        aria-hidden={!open}
        className="fixed inset-0 z-40 bg-slate-900/30 transition-opacity md:hidden"
      />
      <div
        hidden={!open}
        aria-hidden={!open}
        className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 px-3 transition-all md:hidden"
        data-testid="glass-dock-search-overlay"
      >
        <div className="mx-auto w-full max-w-md rounded-3xl border border-white/45 bg-white/80 p-3 shadow-[0_18px_36px_rgba(15,23,42,0.18)] backdrop-blur-xl backdrop-saturate-150">
          <div className="flex items-center gap-2">
            <label htmlFor="glass-dock-search-input" className="sr-only">
              Search homes
            </label>
            <input
              id="glass-dock-search-input"
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                onSubmit();
              }}
              placeholder="Search homes or location"
              className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white/90 px-4 text-sm text-slate-900 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              data-testid="glass-dock-search-input"
            />
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 px-3 text-xs font-semibold text-slate-600"
              data-testid="glass-dock-search-close"
            >
              Close
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <GlassPill
              variant={nearMe ? "dark" : "light"}
              className={cn(
                "cursor-pointer px-3 py-1.5 text-xs font-semibold transition",
                nearMe ? "text-white" : "text-slate-700"
              )}
              onClick={onToggleNearMe}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onToggleNearMe();
              }}
              data-testid="glass-dock-search-near-me"
            >
              Near me
            </GlassPill>
            <button
              type="button"
              onClick={onReset}
              className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700"
              data-testid="glass-dock-search-reset"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onSubmit}
              className="ml-auto rounded-full border border-sky-300 bg-sky-500/90 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-sky-900/15"
              data-testid="glass-dock-search-submit"
            >
              Search
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
