"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import { CURRENCY_CODES, TOP_CURRENCIES, normalizeCurrency } from "@/lib/currencies";

type CurrencyDisplayNames = {
  of: (code: string) => string | undefined;
};

type CurrencyDisplayNamesCtor = new (
  locales: string | string[],
  options: { type: "currency" }
) => CurrencyDisplayNames;

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function CurrencySelect({ id, value, onChange, placeholder, disabled }: Props) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedValue = normalizeCurrency(value) ?? value;

  const displayNames = useMemo(() => {
    if (typeof Intl === "undefined") return null;
    const DisplayNames = (Intl as unknown as { DisplayNames?: CurrencyDisplayNamesCtor })
      .DisplayNames;
    if (!DisplayNames) return null;
    try {
      return new DisplayNames(["en"], { type: "currency" });
    } catch {
      return null;
    }
  }, []);

  const options = useMemo(
    () =>
      CURRENCY_CODES.map((code) => ({
        code,
        label: displayNames?.of(code) ?? null,
      })),
    [displayNames]
  );
  const optionLookup = useMemo(
    () => new Map(options.map((option) => [option.code, option])),
    [options]
  );
  const topSet = useMemo(() => new Set<string>(TOP_CURRENCIES), []);
  const topOptions = useMemo(
    () =>
      TOP_CURRENCIES.map((code) => optionLookup.get(code) ?? { code, label: null }),
    [optionLookup]
  );
  const queryLower = query.trim().toLowerCase();
  const filteredOptions = useMemo(
    () =>
      options.filter((option) => {
        if (topSet.has(option.code)) return false;
        if (!queryLower) return true;
        const codeMatch = option.code.toLowerCase().includes(queryLower);
        const labelMatch = option.label
          ? option.label.toLowerCase().includes(queryLower)
          : false;
        return codeMatch || labelMatch;
      }),
    [options, queryLower, topSet]
  );
  const menuOptions = useMemo(
    () => [...topOptions, ...filteredOptions],
    [filteredOptions, topOptions]
  );

  const formatOptionLabel = (option: { code: string; label: string | null }) =>
    option.label ? `${option.code} - ${option.label}` : option.code;

  const selectedOption = optionLookup.get(normalizedValue);
  const selectedLabel = selectedOption
    ? formatOptionLabel(selectedOption)
    : normalizedValue;

  const handleSelect = (code: string) => {
    const normalized = normalizeCurrency(code) ?? code;
    if (normalized !== value) {
      onChange(normalized);
    }
    setIsOpen(false);
    setQuery("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!menuOptions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, menuOptions.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const active = menuOptions[activeIndex];
      if (active) handleSelect(active.code);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const focusTimer = window.setTimeout(() => {
      searchRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative space-y-2">
      <button
        type="button"
        id={id}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-left text-sm text-slate-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-100"
        onClick={() =>
          setIsOpen((prev) => {
            if (!prev) {
              setActiveIndex(0);
            }
            return !prev;
          })
        }
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        disabled={disabled}
      >
        <span className="truncate">
          {selectedLabel || placeholder || "Select currency"}
        </span>
        <span className="text-slate-400">v</span>
      </button>
      {isOpen ? (
        <div className="absolute z-30 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="p-2">
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder ?? "Search currencies"}
              autoComplete="off"
            />
          </div>
          <div
            id={listId}
            role="listbox"
            className="max-h-64 overflow-y-auto px-2 pb-2 text-sm"
          >
            <div className="px-2 py-1 text-xs font-semibold uppercase text-slate-400">
              Top
            </div>
            <div className="space-y-1">
              {topOptions.map((option, index) => (
                <button
                  key={option.code}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left transition ${
                    activeIndex === index ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handleSelect(option.code)}
                >
                  <span>{formatOptionLabel(option)}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 px-2 py-1 text-xs font-semibold uppercase text-slate-400">
              All currencies
            </div>
            <div className="space-y-1">
              {filteredOptions.length ? (
                filteredOptions.map((option, index) => {
                  const optionIndex = topOptions.length + index;
                  return (
                    <button
                      key={option.code}
                      type="button"
                      role="option"
                      aria-selected={activeIndex === optionIndex}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left transition ${
                        activeIndex === optionIndex
                          ? "bg-slate-100"
                          : "hover:bg-slate-50"
                      }`}
                      onMouseEnter={() => setActiveIndex(optionIndex)}
                      onClick={() => handleSelect(option.code)}
                    >
                      <span>{formatOptionLabel(option)}</span>
                    </button>
                  );
                })
              ) : (
                <div className="px-2 py-2 text-xs text-slate-500">
                  No matches found.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
