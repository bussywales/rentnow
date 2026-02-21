import { SHORTLETS_MARKER_ICON_CACHE_ENABLED } from "@/lib/shortlet/map-perf-config";

export type ShortletMarkerVisualMode = "default" | "hovered" | "selected";

export function formatShortletPinPrice(currency: string, nightlyPriceMinor: number | null): string {
  if (typeof nightlyPriceMinor !== "number" || nightlyPriceMinor <= 0) return "₦—";
  const major = nightlyPriceMinor / 100;
  if (currency === "NGN") {
    return `₦${major.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
  }
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 0,
    }).format(major);
  } catch {
    return `₦${major.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
  }
}

export function createShortletMarkerIconCache<TIcon>(options?: { enabled?: boolean }) {
  const cache = new Map<string, TIcon>();
  const cacheEnabled = options?.enabled ?? SHORTLETS_MARKER_ICON_CACHE_ENABLED;
  return {
    get(input: {
      label: string;
      mode: ShortletMarkerVisualMode;
      create: () => TIcon;
    }): TIcon {
      if (!cacheEnabled) {
        return input.create();
      }
      const key = `${input.mode}::${input.label}`;
      const existing = cache.get(key);
      if (existing) return existing;
      const next = input.create();
      cache.set(key, next);
      return next;
    },
  };
}
