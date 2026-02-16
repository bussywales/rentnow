import { normalizeListingIntent } from "@/lib/listing-intents";
import type { RentalType } from "@/lib/types";

export function isShortletIntentValue(intent?: string | null): boolean {
  return normalizeListingIntent(intent) === "shortlet";
}

export function normalizeShortletNightlyPriceMinor(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = Math.trunc(value);
  if (normalized <= 0) return null;
  return normalized;
}

export function normalizeShortletBookingMode(value: unknown): "instant" | "request" | null {
  if (value === "instant") return "instant";
  if (value === "request") return "request";
  return null;
}

export function resolveShortletBookingMode(
  value: unknown,
  fallback: "instant" | "request" = "request"
): "instant" | "request" {
  return normalizeShortletBookingMode(value) ?? fallback;
}

export function resolveShortletNightlyPriceMinor(input: {
  nightlyPriceMinor?: unknown;
  fallbackPrice?: unknown;
}): number | null {
  return (
    normalizeShortletNightlyPriceMinor(input.nightlyPriceMinor) ??
    normalizeShortletNightlyPriceMinor(input.fallbackPrice)
  );
}

export function resolveRentalTypeForListingIntent(
  listingIntent: string | null | undefined,
  fallback: RentalType = "long_term"
): RentalType {
  return isShortletIntentValue(listingIntent) ? "short_let" : fallback;
}

export function resolveCurrencyDefaultForCountry(input: {
  countryCode?: string | null;
  currentCurrency?: string | null;
  hasUserOverride?: boolean;
  fallbackCurrency?: string;
}): string {
  const fallbackCurrency = (input.fallbackCurrency || "USD").trim().toUpperCase();
  const currentCurrency = (input.currentCurrency || "").trim().toUpperCase();
  const countryCode = (input.countryCode || "").trim().toUpperCase();
  if (input.hasUserOverride && currentCurrency) return currentCurrency;
  if (countryCode === "NG") return "NGN";
  return currentCurrency || fallbackCurrency;
}

export function resolveShortletPersistenceInput(input: {
  listingIntent?: string | null;
  rentalType?: string | null;
  nightlyPriceMinor?: unknown;
  bookingMode?: unknown;
  fallbackPrice?: unknown;
}) {
  const isShortlet =
    isShortletIntentValue(input.listingIntent) ||
    String(input.rentalType || "").toLowerCase() === "short_let";
  if (!isShortlet) {
    return {
      isShortlet: false as const,
      rentalType: (input.rentalType as RentalType) || "long_term",
      bookingMode: resolveShortletBookingMode(input.bookingMode),
      nightlyPriceMinor: null as number | null,
    };
  }
  return {
    isShortlet: true as const,
    rentalType: "short_let" as RentalType,
    bookingMode: resolveShortletBookingMode(input.bookingMode),
    nightlyPriceMinor: resolveShortletNightlyPriceMinor({
      nightlyPriceMinor: input.nightlyPriceMinor,
      fallbackPrice: input.fallbackPrice,
    }),
  };
}
