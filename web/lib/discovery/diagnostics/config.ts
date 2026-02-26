import type { DiscoveryMarket, DiscoverySurface } from "@/lib/discovery";

export type DiscoveryDiagnosticsSurface = DiscoverySurface | "COLLECTIONS";

export const DISCOVERY_DIAGNOSTIC_MARKETS: readonly DiscoveryMarket[] = [
  "GLOBAL",
  "NG",
  "CA",
  "GB",
  "US",
];

export const DISCOVERY_DIAGNOSTIC_SURFACES: readonly DiscoveryDiagnosticsSurface[] = [
  "HOME_FEATURED",
  "SHORTLETS_FEATURED",
  "PROPERTIES_FEATURED",
  "COLLECTIONS",
];

export const DISCOVERY_COVERAGE_THRESHOLDS: Record<DiscoveryDiagnosticsSurface, number> = {
  HOME_FEATURED: 6,
  SHORTLETS_FEATURED: 6,
  PROPERTIES_FEATURED: 6,
  COLLECTIONS: 4,
};

export const TOP_RISKS_LIMIT = 12;
