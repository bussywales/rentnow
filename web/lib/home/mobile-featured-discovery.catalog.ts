import {
  DISCOVERY_CATALOGUE,
  DISCOVERY_MARKETS,
  type DiscoveryCatalogueItem,
  type DiscoveryMarket,
} from "@/lib/discovery";

// Deprecated compatibility alias while home discovery migrates to /lib/discovery.
export type MobileFeaturedDiscoveryCatalogueItem = DiscoveryCatalogueItem;
export type MobileFeaturedDiscoveryMarket = DiscoveryMarket;

export const MOBILE_FEATURED_DISCOVERY_MARKETS = DISCOVERY_MARKETS;
export const MOBILE_FEATURED_DISCOVERY_CATALOGUE: ReadonlyArray<MobileFeaturedDiscoveryCatalogueItem> =
  DISCOVERY_CATALOGUE;
