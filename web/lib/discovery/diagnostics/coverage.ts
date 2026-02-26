import type { DiscoveryCatalogueItem, DiscoveryMarket } from "@/lib/discovery";
import type { StaticCollectionDefinition } from "@/lib/collections/collections-registry";
import {
  DISCOVERY_COVERAGE_THRESHOLDS,
  DISCOVERY_DIAGNOSTIC_MARKETS,
  DISCOVERY_DIAGNOSTIC_SURFACES,
  TOP_RISKS_LIMIT,
  type DiscoveryDiagnosticsSurface,
} from "@/lib/discovery/diagnostics/config";

export type DiscoveryCoverageRow = {
  market: DiscoveryMarket;
  surface: DiscoveryDiagnosticsSurface;
  threshold: number;
  availableCount: number;
  marketSpecificCount: number;
  coverageScore: number;
  deficit: number;
  atRisk: boolean;
};

export type DiscoveryCoverageSummary = {
  rows: DiscoveryCoverageRow[];
  byMarketScore: Record<DiscoveryMarket, number>;
  bySurfaceScore: Record<DiscoveryDiagnosticsSurface, number>;
  overallCoverageScore: number;
  topRisks: DiscoveryCoverageRow[];
};

function supportsDiscoveryMarket(item: DiscoveryCatalogueItem, market: DiscoveryMarket): boolean {
  if (market === "GLOBAL") return item.marketTags.includes("GLOBAL");
  return item.marketTags.includes(market) || item.marketTags.includes("GLOBAL");
}

function isDiscoveryMarketSpecific(item: DiscoveryCatalogueItem, market: DiscoveryMarket): boolean {
  if (market === "GLOBAL") return item.marketTags.includes("GLOBAL");
  return item.marketTags.includes(market);
}

function supportsCollectionMarket(item: StaticCollectionDefinition, market: DiscoveryMarket): boolean {
  if (item.marketTags.includes("ALL")) return true;
  if (market === "GLOBAL") return item.marketTags.includes("GLOBAL");
  return item.marketTags.includes(market) || item.marketTags.includes("GLOBAL");
}

function isCollectionMarketSpecific(item: StaticCollectionDefinition, market: DiscoveryMarket): boolean {
  if (market === "GLOBAL") return item.marketTags.includes("GLOBAL");
  return item.marketTags.includes(market);
}

function buildCoverageRow(input: {
  market: DiscoveryMarket;
  surface: DiscoveryDiagnosticsSurface;
  discoveryItems: ReadonlyArray<DiscoveryCatalogueItem>;
  collectionsItems: ReadonlyArray<StaticCollectionDefinition>;
}): DiscoveryCoverageRow {
  const threshold = DISCOVERY_COVERAGE_THRESHOLDS[input.surface];
  let availableCount = 0;
  let marketSpecificCount = 0;

  if (input.surface === "COLLECTIONS") {
    for (const item of input.collectionsItems) {
      if (!supportsCollectionMarket(item, input.market)) continue;
      availableCount += 1;
      if (isCollectionMarketSpecific(item, input.market)) {
        marketSpecificCount += 1;
      }
    }
  } else {
    for (const item of input.discoveryItems) {
      if (!item.surfaces.includes(input.surface)) continue;
      if (!supportsDiscoveryMarket(item, input.market)) continue;
      availableCount += 1;
      if (isDiscoveryMarketSpecific(item, input.market)) {
        marketSpecificCount += 1;
      }
    }
  }

  const deficit = Math.max(0, threshold - availableCount);
  const atRisk = deficit > 0;
  const coverageScore = threshold <= 0 ? 100 : Math.min(100, Math.round((availableCount / threshold) * 100));

  return {
    market: input.market,
    surface: input.surface,
    threshold,
    availableCount,
    marketSpecificCount,
    coverageScore,
    deficit,
    atRisk,
  };
}

function scoreRows(rows: ReadonlyArray<DiscoveryCoverageRow>): number {
  if (rows.length === 0) return 0;
  const total = rows.reduce((sum, row) => sum + row.coverageScore, 0);
  return Math.round(total / rows.length);
}

export function computeDiscoveryCoverageSummary(input: {
  discoveryItems: ReadonlyArray<DiscoveryCatalogueItem>;
  collectionsItems: ReadonlyArray<StaticCollectionDefinition>;
}): DiscoveryCoverageSummary {
  const rows: DiscoveryCoverageRow[] = [];
  for (const market of DISCOVERY_DIAGNOSTIC_MARKETS) {
    for (const surface of DISCOVERY_DIAGNOSTIC_SURFACES) {
      rows.push(
        buildCoverageRow({
          market,
          surface,
          discoveryItems: input.discoveryItems,
          collectionsItems: input.collectionsItems,
        })
      );
    }
  }

  const byMarketScore = {} as Record<DiscoveryMarket, number>;
  for (const market of DISCOVERY_DIAGNOSTIC_MARKETS) {
    byMarketScore[market] = scoreRows(rows.filter((row) => row.market === market));
  }

  const bySurfaceScore = {} as Record<DiscoveryDiagnosticsSurface, number>;
  for (const surface of DISCOVERY_DIAGNOSTIC_SURFACES) {
    bySurfaceScore[surface] = scoreRows(rows.filter((row) => row.surface === surface));
  }

  const topRisks = rows
    .filter((row) => row.atRisk && row.market !== "GLOBAL")
    .sort((left, right) => {
      if (right.deficit !== left.deficit) return right.deficit - left.deficit;
      if (left.marketSpecificCount !== right.marketSpecificCount) {
        return left.marketSpecificCount - right.marketSpecificCount;
      }
      if (left.market !== right.market) return left.market.localeCompare(right.market);
      return left.surface.localeCompare(right.surface);
    })
    .slice(0, TOP_RISKS_LIMIT);

  return {
    rows,
    byMarketScore,
    bySurfaceScore,
    overallCoverageScore: scoreRows(rows),
    topRisks,
  };
}
