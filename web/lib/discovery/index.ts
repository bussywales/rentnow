export {
  DISCOVERY_MARKETS,
  DISCOVERY_SURFACES,
  DISCOVERY_KINDS,
  DISCOVERY_INTENTS,
  normalizeDiscoveryMarket,
  isDiscoveryMarket,
  isDiscoverySurface,
  type DiscoveryMarket,
  type DiscoverySurface,
  type DiscoveryKind,
  type DiscoveryIntent,
} from "@/lib/discovery/market-taxonomy";
export { DISCOVERY_CATALOGUE, type DiscoveryCatalogueItem } from "@/lib/discovery/discovery-catalogue";
export { validateDiscoveryCatalogue, type DiscoveryValidationResult } from "@/lib/discovery/discovery-validate";
export { selectDiscoveryItems } from "@/lib/discovery/discovery-select";
