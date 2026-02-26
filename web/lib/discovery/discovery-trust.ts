import { MARKET_OPTIONS } from "@/lib/market/market";
import type { DiscoveryCatalogueItem } from "@/lib/discovery/discovery-catalogue";
import type { DiscoveryTrustBadge } from "@/lib/discovery/market-taxonomy";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const BADGE_ORDER: DiscoveryTrustBadge[] = ["VERIFIED", "POPULAR", "NEW"];
const POPULAR_PRIORITY_THRESHOLD = 86;
const DEFAULT_NEW_WINDOW_DAYS = 14;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeCountry(input: string | null | undefined): string {
  const normalized = String(input ?? "")
    .trim()
    .toUpperCase();
  if (normalized === "GB") return "UK";
  return normalized;
}

function normalizeCatalogueDate(input: string | null | undefined): string | null {
  if (!input) return null;
  if (!ISO_DATE_RE.test(input)) return null;
  return Number.isFinite(Date.parse(`${input}T00:00:00.000Z`)) ? input : null;
}

function shouldIncludeNewBadge(input: {
  now?: Date;
  introducedAt?: string | null;
  validFrom?: string | null;
}): boolean {
  const dateKey = toDateKey(input.now ?? new Date());
  const baseDate = normalizeCatalogueDate(input.introducedAt) ?? normalizeCatalogueDate(input.validFrom);
  if (!baseDate) return false;
  const nowMs = Date.parse(`${dateKey}T00:00:00.000Z`);
  const startMs = Date.parse(`${baseDate}T00:00:00.000Z`);
  if (!Number.isFinite(nowMs) || !Number.isFinite(startMs)) return false;
  const deltaDays = Math.floor((nowMs - startMs) / 86_400_000);
  return deltaDays >= 0 && deltaDays <= DEFAULT_NEW_WINDOW_DAYS;
}

function sortBadges(input: ReadonlyArray<DiscoveryTrustBadge>): DiscoveryTrustBadge[] {
  const deduped = Array.from(new Set(input));
  return BADGE_ORDER.filter((badge) => deduped.includes(badge));
}

export function resolveDiscoveryTrustBadges(input: {
  item: Pick<
    DiscoveryCatalogueItem,
    "priority" | "badges" | "verificationBasis" | "introducedAt" | "validFrom"
  >;
  now?: Date;
}): DiscoveryTrustBadge[] {
  const sourceBadges = new Set(input.item.badges ?? []);
  const badges: DiscoveryTrustBadge[] = [];

  if (sourceBadges.has("VERIFIED") && input.item.verificationBasis) {
    badges.push("VERIFIED");
  }
  if (sourceBadges.has("POPULAR") || (input.item.priority ?? 0) >= POPULAR_PRIORITY_THRESHOLD) {
    badges.push("POPULAR");
  }
  if (
    sourceBadges.has("NEW") ||
    shouldIncludeNewBadge({
      now: input.now,
      introducedAt: input.item.introducedAt,
      validFrom: input.item.validFrom,
    })
  ) {
    badges.push("NEW");
  }

  return sortBadges(badges);
}

export function resolveMarketPicksLabel(countryCode: string | null | undefined): string {
  const normalized = normalizeCountry(countryCode);
  const option = MARKET_OPTIONS.find((entry) => normalizeCountry(entry.country) === normalized);
  if (!option) return "Picks for Global";
  return `Picks for ${option.label}`;
}

