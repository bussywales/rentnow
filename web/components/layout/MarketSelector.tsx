"use client";

import { useMemo } from "react";
import {
  MARKET_COOKIE_NAME,
  MARKET_OPTIONS,
  formatCurrencySymbol,
  formatMarketLabel,
  serializeMarketCookieValue,
} from "@/lib/market/market";
import { useMarketPreference } from "@/components/layout/MarketPreferenceProvider";

type Props = {
  enabled: boolean;
  compact?: boolean;
};

export function MarketSelector({ enabled, compact = false }: Props) {
  const { market, setMarket } = useMarketPreference();

  const currentLabel = useMemo(() => formatMarketLabel(market), [market]);

  if (!enabled) return null;

  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      {!compact ? <span className="hidden text-xs text-slate-500 sm:inline">Market</span> : null}
      <select
        aria-label="Select market"
        className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        value={serializeMarketCookieValue(market.country, market.currency)}
        title={currentLabel}
        onChange={(event) => {
          const selected = event.target.value;
          const match = MARKET_OPTIONS.find(
            (option) => serializeMarketCookieValue(option.country, option.currency) === selected
          );
          if (!match) return;
          const nextValue = serializeMarketCookieValue(match.country, match.currency);
          setMarket({
            country: match.country,
            currency: match.currency,
            source: "cookie",
          });
          document.cookie = `${MARKET_COOKIE_NAME}=${encodeURIComponent(nextValue)}; Path=/; Max-Age=31536000; SameSite=Lax`;
          window.location.reload();
        }}
      >
        {MARKET_OPTIONS.map((option) => {
          const value = serializeMarketCookieValue(option.country, option.currency);
          const symbol = formatCurrencySymbol(option.currency);
          return (
            <option key={value} value={value}>
              {option.label} ({symbol})
            </option>
          );
        })}
      </select>
    </label>
  );
}

