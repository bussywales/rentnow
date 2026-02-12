"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ResolvedMarket } from "@/lib/market/market";

type MarketContextValue = {
  market: ResolvedMarket;
  setMarket: (next: ResolvedMarket) => void;
};

const FALLBACK_MARKET: ResolvedMarket = {
  country: "NG",
  currency: "NGN",
  source: "default",
};

const MarketPreferenceContext = createContext<MarketContextValue>({
  market: FALLBACK_MARKET,
  setMarket: () => {},
});

export function MarketPreferenceProvider({
  initialMarket,
  children,
}: {
  initialMarket: ResolvedMarket;
  children: React.ReactNode;
}) {
  const [market, setMarket] = useState<ResolvedMarket>(initialMarket);
  const value = useMemo(() => ({ market, setMarket }), [market]);
  return (
    <MarketPreferenceContext.Provider value={value}>
      {children}
    </MarketPreferenceContext.Provider>
  );
}

export function useMarketPreference() {
  return useContext(MarketPreferenceContext);
}

