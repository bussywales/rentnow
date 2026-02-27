"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import { cn } from "@/components/ui/cn";
import { isSavedItem, subscribeSavedItems, toggleSavedItem, type SavedItemKind } from "@/lib/saved";

type SaveToggleProps = {
  itemId: string;
  kind: SavedItemKind;
  href: string;
  title: string;
  subtitle?: string;
  tag?: string;
  marketCountry?: string | null;
  className?: string;
  testId?: string;
  onToggle?: (saved: boolean) => void;
};

function normalizeMarketCountry(value: string | null | undefined, fallback: string): string {
  const trimmed = (value ?? "").trim().toUpperCase();
  if (/^[A-Z]{2,3}$/.test(trimmed)) return trimmed;
  return fallback;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden
      className={cn("h-4 w-4", filled ? "fill-current" : "fill-none")}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path
        d="M20.5 12.2c-.9 2.8-4.7 6-8.5 8.8-3.8-2.8-7.6-6-8.5-8.8-1-3.1.6-6.2 3.8-6.9 1.9-.4 3.8.2 4.7 1.6.9-1.4 2.8-2 4.7-1.6 3.2.7 4.8 3.8 3.8 6.9z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SaveToggle({
  itemId,
  kind,
  href,
  title,
  subtitle,
  tag,
  marketCountry,
  className,
  testId = "save-toggle",
  onToggle,
}: SaveToggleProps) {
  const { market } = useMarketPreference();
  const resolvedMarket = useMemo(
    () => normalizeMarketCountry(marketCountry, normalizeMarketCountry(market.country, "GLOBAL")),
    [market.country, marketCountry]
  );
  const [saved, setSaved] = useState(false);
  const labelTarget = title?.trim() || "item";

  useEffect(() => {
    const refresh = () => setSaved(isSavedItem(itemId, resolvedMarket));
    refresh();
    return subscribeSavedItems(refresh);
  }, [itemId, resolvedMarket]);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const next = toggleSavedItem({
      id: itemId,
      kind,
      href,
      title,
      subtitle,
      tag,
      marketCountry: resolvedMarket,
    });
    setSaved(next.saved);
    onToggle?.(next.saved);
  };

  return (
    <button
      type="button"
      data-testid={testId}
      data-saved={saved ? "true" : "false"}
      aria-label={saved ? `Unsave ${labelTarget}` : `Save ${labelTarget}`}
      aria-pressed={saved}
      onClick={handleClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/90 shadow-sm ring-1 ring-slate-200/60 backdrop-blur-sm transition",
        saved
          ? "bg-slate-900 text-white hover:bg-slate-800"
          : "bg-white/95 text-slate-700 hover:bg-white hover:text-slate-900",
        className
      )}
    >
      <HeartIcon filled={saved} />
    </button>
  );
}
