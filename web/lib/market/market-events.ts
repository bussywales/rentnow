"use client";

export const MARKET_CHANGED_EVENT = "ph:market-changed";

export type MarketChangedDetail = {
  country: string;
  currency: string;
  label: string;
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function dispatchMarketChanged(detail: MarketChangedDetail): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent<MarketChangedDetail>(MARKET_CHANGED_EVENT, { detail }));
}

export function subscribeMarketChanged(
  listener: (detail: MarketChangedDetail) => void
): () => void {
  if (!isBrowser()) return () => {};
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<MarketChangedDetail>;
    const detail = customEvent.detail;
    if (!detail || typeof detail.country !== "string" || typeof detail.currency !== "string") return;
    listener(detail);
  };
  window.addEventListener(MARKET_CHANGED_EVENT, handler as EventListener);
  return () => {
    window.removeEventListener(MARKET_CHANGED_EVENT, handler as EventListener);
  };
}
