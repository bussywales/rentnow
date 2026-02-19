"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from "react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/components/ui/cn";
import type { ShortletSearchPreset } from "@/lib/shortlet/search-presets";

export type WhereSuggestion = {
  label: string;
  subtitle?: string;
  countryCode?: string;
  marketHint?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  bbox?: string;
};

type SuggestionResponse = {
  suggestions?: WhereSuggestion[];
};

type Props = {
  value: string;
  market: string;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
  onValueChange: (value: string) => void;
  onSelectSuggestion: (suggestion: WhereSuggestion) => void;
  onApplyPreset: (preset: ShortletSearchPreset) => void;
  onSaveCurrent: () => void;
  onClearRecents: () => void;
  onRemoveSaved: (id: string) => void;
  onRequestNearby: () => Promise<void>;
  recentPresets: ShortletSearchPreset[];
  savedPresets: ShortletSearchPreset[];
};

type Option =
  | { id: string; kind: "preset"; source: "recent" | "saved"; preset: ShortletSearchPreset; label: string; subtitle?: string }
  | { id: string; kind: "nearby"; label: string; subtitle?: string }
  | { id: string; kind: "suggestion"; suggestion: WhereSuggestion; label: string; subtitle?: string }
  | { id: string; kind: "free_text"; label: string; subtitle?: string };

export function WhereTypeahead({
  value,
  market,
  inputRef,
  className,
  onValueChange,
  onSelectSuggestion,
  onApplyPreset,
  onSaveCurrent,
  onClearRecents,
  onRemoveSaved,
  onRequestNearby,
  recentPresets,
  savedPresets,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<WhereSuggestion[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    const query = value.trim();
    if (!open || query.length < 1) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/places/suggest?q=${encodeURIComponent(query)}&market=${encodeURIComponent(market || "NG")}&limit=8`,
          { signal: controller.signal, credentials: "include" }
        );
        const payload = (await response.json().catch(() => null)) as SuggestionResponse | null;
        if (!controller.signal.aborted) {
          setSuggestions(Array.isArray(payload?.suggestions) ? payload?.suggestions : []);
        }
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [market, open, value]);

  const options = useMemo<Option[]>(() => {
    const next: Option[] = [];
    for (const preset of recentPresets) {
      next.push({
        id: `recent-${preset.id}`,
        kind: "preset",
        source: "recent",
        preset,
        label: preset.label,
        subtitle: "Recent search",
      });
    }
    for (const preset of savedPresets) {
      next.push({
        id: `saved-${preset.id}`,
        kind: "preset",
        source: "saved",
        preset,
        label: preset.label,
        subtitle: "Saved search",
      });
    }
    next.push({
      id: "nearby-current-location",
      kind: "nearby",
      label: "Search nearby",
      subtitle: "Use your current location",
    });
    for (const suggestion of suggestions) {
      next.push({
        id: `suggestion-${suggestion.placeId ?? suggestion.label}`,
        kind: "suggestion",
        suggestion,
        label: suggestion.label,
        subtitle: suggestion.subtitle,
      });
    }

    const query = value.trim();
    if (query) {
      next.push({
        id: `free-${query.toLowerCase()}`,
        kind: "free_text",
        label: `Search "${query}" worldwide`,
        subtitle: "Use this exact destination text",
      });
    }
    return next;
  }, [recentPresets, savedPresets, suggestions, value]);

  useEffect(() => {
    if (highlightedIndex >= options.length) {
      setHighlightedIndex(0);
    }
  }, [highlightedIndex, options.length]);

  const selectOption = useCallback(
    (option: Option) => {
      if (option.kind === "preset") {
        onApplyPreset(option.preset);
        setOpen(false);
        return;
      }
      if (option.kind === "nearby") {
        void onRequestNearby().finally(() => setOpen(false));
        return;
      }
      if (option.kind === "suggestion") {
        onSelectSuggestion(option.suggestion);
        setOpen(false);
        return;
      }
      onSelectSuggestion({
        label: value.trim(),
      });
      setOpen(false);
    },
    [onApplyPreset, onRequestNearby, onSelectSuggestion, value]
  );

  const openWhenUseful = useCallback(() => {
    if (value.trim().length > 0 || recentPresets.length > 0 || savedPresets.length > 0) {
      setOpen(true);
    }
  }, [recentPresets.length, savedPresets.length, value]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={openWhenUseful}
        onClick={openWhenUseful}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            setOpen(true);
            return;
          }
          if (!options.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlightedIndex((current) => (current + 1) % options.length);
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((current) => (current - 1 + options.length) % options.length);
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            const option = options[highlightedIndex] ?? options[0];
            if (option) selectOption(option);
          }
        }}
        placeholder="Where to?"
        aria-label="Where"
        className="h-11"
        autoComplete="off"
      />

      {open ? (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[360px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
          role="listbox"
          data-testid="where-typeahead-dropdown"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={onSaveCurrent}
              className="text-xs font-semibold text-sky-700 hover:text-sky-800"
            >
              Save this search
            </button>
            {recentPresets.length > 0 ? (
              <button
                type="button"
                onClick={onClearRecents}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Clear recents
              </button>
            ) : null}
          </div>

          {loading ? (
            <p className="rounded-lg px-3 py-2 text-sm text-slate-500">Searching…</p>
          ) : options.length === 0 ? (
            <p className="rounded-lg px-3 py-2 text-sm text-slate-500">No matches — try a nearby city.</p>
          ) : (
            <div className="space-y-1">
              {options.map((option, index) => (
                <div
                  key={option.id}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-lg px-3 py-2 transition",
                    index === highlightedIndex ? "bg-slate-100" : "hover:bg-slate-50"
                  )}
                >
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectOption(option)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-medium text-slate-900">{option.label}</span>
                    {option.subtitle ? (
                      <span className="block truncate text-xs text-slate-500">{option.subtitle}</span>
                    ) : null}
                  </button>
                  {option.kind === "preset" && option.source === "saved" ? (
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onRemoveSaved(option.preset.id)}
                      className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
