import { isSaleIntent, normalizeListingIntent } from "@/lib/listing-intents";
import { isShortletProperty } from "@/lib/shortlet/discovery";
import type { DiscoveryTrustBadge } from "@/lib/discovery";
import type { Property } from "@/lib/types";

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

export function resolveExploreTrustBadges(
  property: Property,
  options: { now?: Date } = {}
): DiscoveryTrustBadge[] {
  const now = options.now ?? new Date();
  const badges: DiscoveryTrustBadge[] = [];

  if (property.is_featured) {
    badges.push("POPULAR");
  }

  if (property.created_at) {
    const createdAt = Date.parse(property.created_at);
    if (Number.isFinite(createdAt) && now.getTime() - createdAt <= NEW_BADGE_WINDOW_MS) {
      badges.push("NEW");
    }
  }

  return Array.from(new Set(badges));
}
