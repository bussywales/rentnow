import { normalizeListingIntent } from "@/lib/listing-intents";
import { isShortletProperty } from "@/lib/shortlet/discovery";

type ShortletSettingsSignal =
  | {
      booking_mode?: string | null;
      nightly_price_minor?: number | null;
    }
  | Array<{
      booking_mode?: string | null;
      nightly_price_minor?: number | null;
    }>
  | null
  | undefined;

type ShortletManageInput = {
  listing_intent?: string | null;
  rental_type?: string | null;
  shortlet_settings?: ShortletSettingsSignal;
  listing_currency?: string | null;
  selected_market_country?: string | null;
  selected_market_currency?: string | null;
};

export type ShortletManageReason =
  | "ok"
  | "listing_not_shortlet"
  | "shortlet_signal_without_intent";

function hasShortletSettingsSignal(settings: ShortletSettingsSignal): boolean {
  if (Array.isArray(settings)) return settings.length > 0;
  return !!settings && typeof settings === "object";
}

function normalizeRentalType(value: string | null | undefined): string | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  return normalized || null;
}

export function resolveShortletManageState(input: ShortletManageInput) {
  const normalizedListingIntent = normalizeListingIntent(input.listing_intent);
  const normalizedRentalType = normalizeRentalType(input.rental_type);
  const listingCurrency = String(input.listing_currency || "").trim().toUpperCase() || null;
  const selectedMarketCountry =
    String(input.selected_market_country || "").trim().toUpperCase() || null;
  const selectedMarketCurrency =
    String(input.selected_market_currency || "").trim().toUpperCase() || null;
  const hasSettingsSignal = hasShortletSettingsSignal(input.shortlet_settings);
  const hasShortletSignal = isShortletProperty({
    listing_intent: input.listing_intent,
    rental_type: normalizedRentalType,
    shortlet_settings: input.shortlet_settings ?? null,
  });
  const isCanonicalShortlet = normalizedListingIntent === "shortlet";
  const isManageable = isCanonicalShortlet;
  const requiresConversion = !isManageable && hasShortletSignal;

  const reason: ShortletManageReason = isManageable
    ? "ok"
    : requiresConversion
      ? "shortlet_signal_without_intent"
      : "listing_not_shortlet";

  const marketMismatch =
    !!listingCurrency &&
    !!selectedMarketCurrency &&
    selectedMarketCurrency !== listingCurrency;

  return {
    isManageable,
    requiresConversion,
    reason,
    hasShortletSignal,
    hasSettingsSignal,
    normalizedListingIntent,
    normalizedRentalType,
    listingCurrency,
    selectedMarketCountry,
    selectedMarketCurrency,
    marketMismatch,
  };
}

export function canRoleManageShortletSettings(role: string | null | undefined): boolean {
  return role === "landlord" || role === "agent" || role === "admin";
}
