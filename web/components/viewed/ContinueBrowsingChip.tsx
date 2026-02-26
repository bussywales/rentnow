"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";
import {
  clearLastBrowseUrl,
  getLastBrowseUrl,
  setLastBrowseUrl,
  subscribeLastBrowseUrl,
  type ViewedItemKind,
} from "@/lib/viewed";

type ContinueBrowsingChipProps = {
  kind: ViewedItemKind;
  marketCountry?: string | null;
  persistCurrentBrowse?: boolean;
  className?: string;
  testId?: string;
};

function normalizeMarketCountry(value: string | null | undefined, fallback: string): string {
  const candidate = (value ?? "").trim().toUpperCase();
  if (/^[A-Z]{2,3}$/.test(candidate)) return candidate;
  return fallback;
}

export function ContinueBrowsingChip({
  kind,
  marketCountry,
  persistCurrentBrowse = false,
  className,
  testId = "continue-browsing-chip",
}: ContinueBrowsingChipProps) {
  const { market } = useMarketPreference();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [href, setHref] = useState<string | null>(null);

  const query = searchParams?.toString() ?? "";
  const currentHref = useMemo(
    () => (query ? `${pathname}?${query}` : pathname),
    [pathname, query]
  );
  const resolvedMarket = useMemo(
    () => normalizeMarketCountry(marketCountry, market.country),
    [market.country, marketCountry]
  );

  useEffect(() => {
    if (!persistCurrentBrowse) return;
    if (!query) return;
    const matchesKindPath =
      (kind === "shortlet" && pathname.startsWith("/shortlets")) ||
      (kind === "property" && pathname.startsWith("/properties"));
    if (!matchesKindPath) return;

    setLastBrowseUrl({
      kind,
      marketCountry: resolvedMarket,
      href: currentHref,
    });
  }, [currentHref, kind, pathname, persistCurrentBrowse, query, resolvedMarket]);

  useEffect(() => {
    const refresh = () => {
      const nextHref = getLastBrowseUrl({
        kind,
        marketCountry: resolvedMarket,
      });
      setHref(nextHref && nextHref !== currentHref ? nextHref : null);
    };

    const frame = window.requestAnimationFrame(refresh);
    const unsubscribe = subscribeLastBrowseUrl(refresh);
    return () => {
      window.cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [currentHref, kind, resolvedMarket]);

  if (!href) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm ${className ?? ""}`}
      data-testid={testId}
      role="region"
      aria-label={`${kind === "shortlet" ? "Shortlets" : "Properties"} continue browsing`}
    >
      <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">Continue browsing</span>
      <Link
        href={href}
        className="font-semibold text-sky-700 hover:text-sky-800"
        data-testid={`${testId}-link`}
        aria-label={`Resume browsing ${kind === "shortlet" ? "shortlets" : "properties"}`}
      >
        Resume
      </Link>
      <button
        type="button"
        className="font-semibold text-slate-500 hover:text-slate-900"
        data-testid={`${testId}-clear`}
        aria-label={`Clear ${kind === "shortlet" ? "shortlets" : "properties"} continue browsing`}
        onClick={() => {
          clearLastBrowseUrl({
            kind,
            marketCountry: resolvedMarket,
          });
          setHref(null);
        }}
      >
        Clear
      </button>
    </div>
  );
}
