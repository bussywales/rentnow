export const DISCOVERY_MARKETS = ["GLOBAL", "NG", "CA", "UK", "US"] as const;
export type DiscoveryMarket = (typeof DISCOVERY_MARKETS)[number];

export const DISCOVERY_SURFACES = [
  "HOME_FEATURED",
  "SHORTLETS_FEATURED",
  "PROPERTIES_FEATURED",
] as const;
export type DiscoverySurface = (typeof DISCOVERY_SURFACES)[number];

export const DISCOVERY_KINDS = ["shortlet", "property"] as const;
export type DiscoveryKind = (typeof DISCOVERY_KINDS)[number];

export const DISCOVERY_INTENTS = ["shortlet", "rent", "buy"] as const;
export type DiscoveryIntent = (typeof DISCOVERY_INTENTS)[number];

export const DISCOVERY_TRUST_BADGES = ["VERIFIED", "POPULAR", "NEW"] as const;
export type DiscoveryTrustBadge = (typeof DISCOVERY_TRUST_BADGES)[number];

export const DISCOVERY_VERIFICATION_BASES = [
  "AGENT_VERIFIED",
  "ID_CHECKED",
  "MANUAL_REVIEW",
] as const;
export type DiscoveryVerificationBasis = (typeof DISCOVERY_VERIFICATION_BASES)[number];

const MARKET_ALIASES: Record<string, DiscoveryMarket> = {
  GLOBAL: "GLOBAL",
  NG: "NG",
  CA: "CA",
  UK: "UK",
  GB: "UK",
  US: "US",
};

export function normalizeDiscoveryMarket(input: string | null | undefined): DiscoveryMarket {
  const normalized = input?.trim().toUpperCase() ?? "";
  return MARKET_ALIASES[normalized] ?? "GLOBAL";
}

export function isDiscoveryMarket(input: string | null | undefined): input is DiscoveryMarket {
  if (!input) return false;
  return DISCOVERY_MARKETS.includes(input as DiscoveryMarket);
}

export function isDiscoverySurface(input: string | null | undefined): input is DiscoverySurface {
  if (!input) return false;
  return DISCOVERY_SURFACES.includes(input as DiscoverySurface);
}
