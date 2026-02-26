"use client";

import { useEffect, useRef, useState } from "react";
import {
  subscribeMarketChanged,
  type MarketChangedDetail,
} from "@/lib/market/market-events";

const TOAST_DURATION_MS = 3200;

export function MarketSwitchToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return subscribeMarketChanged((detail: MarketChangedDetail) => {
      setMessage(`Now showing picks for ${detail.label}`);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setMessage(null);
        timeoutRef.current = null;
      }, TOAST_DURATION_MS);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4">
      <p
        className="rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur"
        data-testid="market-switch-toast"
      >
        {message}
      </p>
    </div>
  );
}
