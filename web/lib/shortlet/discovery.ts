import { normalizeListingIntent } from "@/lib/listing-intents";

type ShortletSettingsLike = {
  booking_mode?: string | null;
  nightly_price_minor?: number | null;
};

type ShortletSignals = {
  listing_intent?: string | null;
  rental_type?: string | null;
  shortlet_settings?: ShortletSettingsLike[] | ShortletSettingsLike | null;
};

type PublicVisibilitySignals = {
  status?: string | null;
  is_active?: boolean | null;
  is_approved?: boolean | null;
  is_demo?: boolean | null;
  expires_at?: string | null;
};

function parseShortletSettings(
  value: ShortletSignals["shortlet_settings"]
): ShortletSettingsLike | null {
  if (Array.isArray(value)) {
    const first = value[0];
    if (!first || typeof first !== "object") return null;
    return first;
  }
  if (value && typeof value === "object") {
    return value;
  }
  return null;
}

export function resolveShortletBookingMode(input: ShortletSignals): "instant" | "request" | null {
  const settings = parseShortletSettings(input.shortlet_settings);
  if (!settings) return null;
  if (settings.booking_mode === "instant") return "instant";
  if (settings.booking_mode === "request") return "request";
  return null;
}

export function resolveShortletNightlyPriceMinor(input: ShortletSignals): number | null {
  const settings = parseShortletSettings(input.shortlet_settings);
  if (!settings || typeof settings.nightly_price_minor !== "number") return null;
  if (!Number.isFinite(settings.nightly_price_minor)) return null;
  return Math.max(0, Math.trunc(settings.nightly_price_minor));
}

export function isShortletProperty(input: ShortletSignals): boolean {
  if (parseShortletSettings(input.shortlet_settings)) return true;
  if (normalizeListingIntent(input.listing_intent) === "shortlet") return true;
  return String(input.rental_type || "").toLowerCase() === "short_let";
}

export function isPubliclyVisibleDiscoveryProperty(
  input: PublicVisibilitySignals,
  options: {
    nowIso?: string;
    includeDemo?: boolean;
  } = {}
): boolean {
  const status = String(input.status || "").trim().toLowerCase();
  if (status !== "live") return false;
  if (!input.is_active || !input.is_approved) return false;
  if (!options.includeDemo && input.is_demo) return false;

  const expiresAt = input.expires_at;
  if (!expiresAt) return true;
  const expiresAtMs = Date.parse(expiresAt);
  const nowMs = Date.parse(options.nowIso ?? new Date().toISOString());
  if (!Number.isFinite(expiresAtMs) || !Number.isFinite(nowMs)) return true;
  return expiresAtMs >= nowMs;
}

export function isDiscoverableShortletProperty(
  input: ShortletSignals & PublicVisibilitySignals,
  options: {
    nowIso?: string;
    includeDemo?: boolean;
  } = {}
): boolean {
  return (
    isPubliclyVisibleDiscoveryProperty(input, options) &&
    isShortletProperty(input)
  );
}
