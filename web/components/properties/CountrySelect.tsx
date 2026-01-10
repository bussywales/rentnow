"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import {
  COUNTRIES,
  TOP_COUNTRIES,
  getCountryByCode,
  getCountryByName,
  type CountryOption,
} from "@/lib/countries";

type Props = {
  id?: string;
  value?: { code?: string | null; name?: string | null } | null;
  onChange: (value: CountryOption) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function CountrySelect({ id, value, onChange, placeholder, disabled }: Props) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [openUp, setOpenUp] = useState(false);

  const options = useMemo(
    () => COUNTRIES.map((country) => ({ ...country })),
    []
  );
  const optionByCode = useMemo(
    () => new Map(options.map((option) => [option.code, option])),
    [options]
  );
  const topSet = useMemo(() => new Set<string>(TOP_COUNTRIES), []);
  const topOptions = useMemo(
    () =>
      TOP_COUNTRIES.map((code) => optionByCode.get(code) || null).filter(
        (option): option is (typeof options)[number] => !!option
      ),
    [optionByCode]
  );

  const queryLower = query.trim().toLowerCase();
  const filteredOptions = useMemo(
    () =>
      options.filter((option) => {
        if (topSet.has(option.code)) return false;
        if (!queryLower) return true;
        return (
          option.code.toLowerCase().includes(queryLower) ||
          option.name.toLowerCase().includes(queryLower)
        );
      }),
    [options, queryLower, topSet]
  );

  const menuOptions = useMemo(
    () => [...topOptions, ...filteredOptions],
    [filteredOptions, topOptions]
  );

  const formatOptionLabel = (option: { code: string; name: string }) =>
    `${option.code} - ${option.name}`;

  const selectedOption =
    (value?.code ? getCountryByCode(value.code) : null) ||
    (value?.name ? getCountryByName(value.name) : null);
  const selectedLabel = selectedOption
    ? formatOptionLabel(selectedOption)
    : value?.name || value?.code || "";

  const handleSelect = (option: { code: string; name: string }) => {
    onChange(option);
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
      if (active) handleSelect(active);
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
            if (!prev && containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              const shouldFlip = spaceBelow < 240 && rect.top > 240;
              setOpenUp(shouldFlip);
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
          {selectedLabel || placeholder || "Select country"}
        </span>
        <span className="text-slate-400">v</span>
      </button>
      {isOpen ? (
        <div
          className={`absolute z-40 w-full rounded-lg border border-slate-200 bg-white shadow-lg ${
            openUp ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <div className="p-2">
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder ?? "Search countries"}
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
                  } ${
                    selectedOption?.code === option.code
                      ? "font-semibold text-slate-900"
                      : ""
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handleSelect(option)}
                >
                  <span>{formatOptionLabel(option)}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 border-t border-slate-100 px-2 py-2 text-xs font-semibold uppercase text-slate-400">
              All countries
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
                      } ${
                        selectedOption?.code === option.code
                          ? "font-semibold text-slate-900"
                          : ""
                      }`}
                      onMouseEnter={() => setActiveIndex(optionIndex)}
                      onClick={() => handleSelect(option)}
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
