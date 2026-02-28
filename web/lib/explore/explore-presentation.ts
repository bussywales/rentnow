import { isSaleIntent, normalizeListingIntent } from "@/lib/listing-intents";
import { isShortletProperty } from "@/lib/shortlet/discovery";
import type { Property } from "@/lib/types";
import type { TrustMarkerState } from "@/lib/trust-markers";
import { DEFAULT_VERIFICATION_REQUIREMENTS, isAdvertiserVerified } from "@/lib/trust-markers";

const NEW_BADGE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const SUPPORTED_MARKETS = new Set(["NG", "GB", "CA", "US"]);
const MARKET_NAME_TO_CODE: Record<string, "NG" | "GB" | "CA" | "US"> = {
  nigeria: "NG",
  "united kingdom": "GB",
  uk: "GB",
  gb: "GB",
  canada: "CA",
  "united states": "US",
  usa: "US",
  us: "US",
};

function normalizeExploreMarketCode(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "UK") return "GB";
  if (!SUPPORTED_MARKETS.has(normalized)) return null;
  return normalized;
}

export function resolveExploreListingKind(property: Property): "shortlet" | "property" {
  return isShortletProperty(property) ? "shortlet" : "property";
}

export function resolveExploreDetailsHref(property: Property): string {
  return `/properties/${property.id}?source=explore_v0`;
}

export function resolveExplorePrimaryAction(property: Property): {
  label: "Book" | "Request viewing";
  href: string;
} {
  const detailsHref = resolveExploreDetailsHref(property);
  return {
    label: isShortletProperty(property) ? "Book" : "Request viewing",
    href: `${detailsHref}#cta`,
  };
}

export function resolveExploreViewingRequestTemplate(property: Property): string {
  const listingLabel = (property.title ?? "this listing").trim() || "this listing";
  return `Hi, I'd like to request a viewing for ${listingLabel}. I'm available [days/times]. Please let me know the next steps.`;
}

export type ExploreAvailabilityChip = "Weekdays" | "Weekends" | "Evenings" | "Anytime";

const AVAILABILITY_LINE_BY_CHIP: Record<ExploreAvailabilityChip, string> = {
  Weekdays: "I'm available on weekdays.",
  Weekends: "I'm available on weekends.",
  Evenings: "I'm available in the evenings.",
  Anytime: "I'm flexible on timing.",
};

const AVAILABILITY_LINES_REGEX =
  /I['’]m available\s*\[days\/times\]\.|I['’]m available on weekdays\.|I['’]m available on weekends\.|I['’]m available in the evenings\.|I['’]m flexible on timing\./gi;

export function applyExploreAvailabilityChipToMessage(
  message: string,
  chip: ExploreAvailabilityChip
): string {
  const base = message
    .replace(AVAILABILITY_LINES_REGEX, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const availabilityLine = AVAILABILITY_LINE_BY_CHIP[chip];
  if (!base) return availabilityLine;

  return `${base}\n${availabilityLine}`;
}

export function resolveExploreListingMarketCountry(
  property: Property,
  fallbackMarketCountry: string | null | undefined
): string {
  const fromCountryCode = normalizeExploreMarketCode(property.country_code);
  if (fromCountryCode) return fromCountryCode;

  const byCountryName =
    typeof property.country === "string" ? MARKET_NAME_TO_CODE[property.country.trim().toLowerCase()] : null;
  if (byCountryName) return byCountryName;

  return normalizeExploreMarketCode(fallbackMarketCountry) ?? "NG";
}

export function resolveExploreCtaMicrocopy(property: Property): string {
  return isShortletProperty(property)
    ? "Secure checkout. Confirm your stay in minutes."
    : "No commitment. We will contact you to confirm a viewing time.";
}

export function resolveExploreIntentTag(property: Property): string {
  if (isShortletProperty(property)) return "Shortlets";
  const normalizedIntent = normalizeListingIntent(property.listing_intent);
  if (normalizedIntent === "off_plan") return "Off-plan";
  if (normalizedIntent && isSaleIntent(normalizedIntent)) return "For sale";
  if (normalizedIntent === "rent_lease") return "To rent";
  return "All homes";
}

export function resolveExploreAnalyticsIntentType(property: Property): "shortlet" | "rent" | "buy" {
  if (isShortletProperty(property)) return "shortlet";
  const normalizedIntent = normalizeListingIntent(property.listing_intent);
  if (normalizedIntent === "rent_lease") return "rent";
  if (normalizedIntent && isSaleIntent(normalizedIntent)) return "buy";
  return "rent";
}

export type ExploreTrustBadge = {
  key: "verified" | "updated_recently" | "fast_response";
  label: "Verified" | "Updated recently" | "Fast response";
};

function isRecentlyUpdated(timestamp: string | null | undefined, now: Date): boolean {
  if (!timestamp) return false;
  const updatedAtMs = Date.parse(timestamp);
  if (!Number.isFinite(updatedAtMs)) return false;
  const elapsed = now.getTime() - updatedAtMs;
  return elapsed >= 0 && elapsed <= NEW_BADGE_WINDOW_MS;
}

function toObjectRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object") return null;
  return input as Record<string, unknown>;
}

function buildTrustMarkerStateFromListing(property: Property): TrustMarkerState | null {
  const ownerProfile = toObjectRecord(property.owner_profile);
  if (!ownerProfile) return null;

  const emailVerified = ownerProfile.email_verified;
  const phoneVerified = ownerProfile.phone_verified;
  const bankVerified = ownerProfile.bank_verified;
  const hasAnySignal = emailVerified !== undefined || phoneVerified !== undefined || bankVerified !== undefined;
  if (!hasAnySignal) return null;

  return {
    email_verified: emailVerified === true,
    phone_verified: phoneVerified === true,
    bank_verified: bankVerified === true,
  };
}

function hasFastResponseSignal(property: Property): boolean {
  const row = toObjectRecord(property);
  const ownerProfile = toObjectRecord(property.owner_profile);
  const rawResponseMinutes = row?.response_time_minutes;
  const rawResponseSeconds = row?.response_time_seconds;
  const rawResponseBucket = row?.response_time_bucket;

  if (row?.fast_responder === true || row?.is_fast_responder === true || ownerProfile?.fast_responder === true) {
    return true;
  }

  if (typeof rawResponseMinutes === "number" && Number.isFinite(rawResponseMinutes) && rawResponseMinutes <= 60) {
    return true;
  }
  if (typeof rawResponseSeconds === "number" && Number.isFinite(rawResponseSeconds) && rawResponseSeconds <= 3600) {
    return true;
  }
  if (typeof rawResponseBucket === "string") {
    const normalizedBucket = rawResponseBucket.trim().toLowerCase();
    if (normalizedBucket === "fast" || normalizedBucket === "within_hour" || normalizedBucket === "under_1h") {
      return true;
    }
  }

  return false;
}

export function resolveExploreTrustBadges(
  property: Property,
  options: { now?: Date } = {}
): ExploreTrustBadge[] {
  const now = options.now ?? new Date();
  const badges: ExploreTrustBadge[] = [];
  const markers = buildTrustMarkerStateFromListing(property);
  const isVerified = isAdvertiserVerified(markers, DEFAULT_VERIFICATION_REQUIREMENTS);
  const updatedRecently = isRecentlyUpdated(property.status_updated_at ?? property.updated_at ?? null, now);
  const fastResponse = hasFastResponseSignal(property);

  if (isVerified) {
    badges.push({ key: "verified", label: "Verified" });
  }

  if (updatedRecently) {
    badges.push({ key: "updated_recently", label: "Updated recently" });
  }

  if (fastResponse) {
    badges.push({ key: "fast_response", label: "Fast response" });
  }

  return badges.slice(0, 2);
}
