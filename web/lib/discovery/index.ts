export {
  DISCOVERY_MARKETS,
  DISCOVERY_SURFACES,
  DISCOVERY_KINDS,
  DISCOVERY_INTENTS,
  DISCOVERY_TRUST_BADGES,
  DISCOVERY_VERIFICATION_BASES,
  normalizeDiscoveryMarket,
  isDiscoveryMarket,
  isDiscoverySurface,
  type DiscoveryMarket,
  type DiscoverySurface,
  type DiscoveryKind,
  type DiscoveryIntent,
  type DiscoveryTrustBadge,
  type DiscoveryVerificationBasis,
} from "@/lib/discovery/market-taxonomy";
export {
  DISCOVERY_CATALOGUE,
  getDiscoveryCatalogueItemById,
  type DiscoveryCatalogueItem,
} from "@/lib/discovery/discovery-catalogue";
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
  resolveDiscoveryTrustBadges,
  resolveMarketPicksLabel,
} from "@/lib/discovery/discovery-trust";
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
