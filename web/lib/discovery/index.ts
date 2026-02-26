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
export {
  DISCOVERY_VALIDATION_REASON_CODES,
  validateDiscoveryCatalogue,
  type DiscoveryValidationReasonCode,
  type DiscoveryValidationIssue,
  type DiscoveryValidationDiagnostics,
  type DiscoveryValidationResult,
} from "@/lib/discovery/discovery-validate";
export { selectDiscoveryItems } from "@/lib/discovery/discovery-select";
export {
  buildShortletsFeaturedHref,
  selectShortletsFeaturedRailItems,
  type ShortletsFeaturedRailItem,
} from "@/lib/discovery/shortlets-featured";
export {
  buildPropertiesFeaturedHref,
  selectPropertiesFeaturedRailItems,
  type PropertiesFeaturedRailItem,
} from "@/lib/discovery/properties-featured";
