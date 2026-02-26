import {
  DISCOVERY_CATALOGUE,
  DISCOVERY_MARKETS,
  validateDiscoveryCatalogue,
  type DiscoveryMarket,
  type DiscoverySurface,
} from "@/lib/discovery";
import {
  getCollectionsRegistryDiagnostics,
  type CollectionMarketTag,
  type StaticCollectionDefinition,
} from "@/lib/collections/collections-registry";
import { getSystemHealthEnvStatus } from "@/lib/admin/system-health";
import {
  computeDiscoveryCoverageSummary,
  type DiscoveryCoverageSummary,
} from "@/lib/discovery/diagnostics/coverage";

export type DiscoverySurfaceKey = DiscoverySurface | "COLLECTIONS";

export type HealthIssue = {
  source: "discovery" | "collections";
  id: string | null;
  reasonCodes: readonly string[];
  details: string;
};

export type HealthReasonCount = {
  reasonCode: string;
  count: number;
};

export type AdminDiscoveryHealthSnapshot = {
  generatedAt: string;
  build: {
    commitSha: string | null;
    version: string;
    nodeEnv: string;
  };
  counts: {
    markets: Record<DiscoveryMarket, number>;
    surfaces: Record<DiscoverySurfaceKey, number>;
  };
  discovery: {
    totalInput: number;
    validCount: number;
    invalidCount: number;
    disabledCount: number;
    notYetActiveCount: number;
    expiredCount: number;
    brokenRoutingCount: number;
    reasonCounts: HealthReasonCount[];
  };
  collections: {
    totalInput: number;
    validCount: number;
    invalidCount: number;
    disabledCount: number;
    notYetActiveCount: number;
    expiredCount: number;
    brokenRoutingCount: number;
    reasonCounts: HealthReasonCount[];
  };
  coverage: DiscoveryCoverageSummary;
  invalidEntries: HealthIssue[];
};

function initMarketCounts(): Record<DiscoveryMarket, number> {
  return {
    GLOBAL: 0,
    NG: 0,
    CA: 0,
    UK: 0,
    US: 0,
  };
}

function initSurfaceCounts(): Record<DiscoverySurfaceKey, number> {
  return {
    HOME_FEATURED: 0,
    SHORTLETS_FEATURED: 0,
    PROPERTIES_FEATURED: 0,
    COLLECTIONS: 0,
  };
}

function countDiscoveryMarkets(target: Record<DiscoveryMarket, number>, marketTags: readonly DiscoveryMarket[]) {
  for (const market of marketTags) {
    if (target[market] !== undefined) {
      target[market] += 1;
    }
  }
}

function appliesToMarket(item: StaticCollectionDefinition, market: DiscoveryMarket): boolean {
  if (item.marketTags.includes("ALL")) return true;
  if (item.marketTags.includes(market as CollectionMarketTag)) return true;
  if (market !== "GLOBAL" && item.marketTags.includes("GLOBAL")) return true;
  return false;
}

function mapReasonCounts(reasonCodes: string[]): HealthReasonCount[] {
  const counts = new Map<string, number>();
  for (const reasonCode of reasonCodes) {
    counts.set(reasonCode, (counts.get(reasonCode) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([reasonCode, count]) => ({ reasonCode, count }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.reasonCode.localeCompare(right.reasonCode);
    });
}

export function buildAdminDiscoveryHealthSnapshot(now: Date = new Date()): AdminDiscoveryHealthSnapshot {
  const discoveryValidation = validateDiscoveryCatalogue({
    items: DISCOVERY_CATALOGUE,
    now,
    mode: "diagnostics",
  });
  const collectionsValidation = getCollectionsRegistryDiagnostics(now);

  const discoveryDiagnostics = discoveryValidation.diagnostics;
  const collectionsDiagnostics = collectionsValidation.diagnostics;

  const marketCounts = initMarketCounts();
  const surfaceCounts = initSurfaceCounts();

  for (const item of discoveryValidation.items) {
    countDiscoveryMarkets(marketCounts, item.marketTags);
    for (const surface of item.surfaces) {
      surfaceCounts[surface] += 1;
    }
  }

  for (const item of collectionsValidation.items) {
    surfaceCounts.COLLECTIONS += 1;
    for (const market of DISCOVERY_MARKETS) {
      if (appliesToMarket(item, market)) {
        marketCounts[market] += 1;
      }
    }
  }

  const discoveryIssues = discoveryDiagnostics?.issues ?? [];
  const collectionsIssues = collectionsDiagnostics?.issues ?? [];
  const coverage = computeDiscoveryCoverageSummary({
    discoveryItems: discoveryValidation.items,
    collectionsItems: collectionsValidation.items,
  });

  const invalidEntries: HealthIssue[] = [
    ...discoveryIssues.map((issue) => ({
      source: "discovery" as const,
      id: issue.id,
      reasonCodes: issue.reasonCodes,
      details: issue.details,
    })),
    ...collectionsIssues.map((issue) => ({
      source: "collections" as const,
      id: issue.slug,
      reasonCodes: issue.reasonCodes,
      details: issue.details,
    })),
  ];

  const envStatus = getSystemHealthEnvStatus();

  return {
    generatedAt: now.toISOString(),
    build: {
      commitSha: envStatus.commitSha,
      version: process.env.npm_package_version || "unknown",
      nodeEnv: process.env.NODE_ENV || "unknown",
    },
    counts: {
      markets: marketCounts,
      surfaces: surfaceCounts,
    },
    discovery: {
      totalInput: discoveryDiagnostics?.totalInput ?? DISCOVERY_CATALOGUE.length,
      validCount: discoveryDiagnostics?.validCount ?? discoveryValidation.items.length,
      invalidCount: discoveryDiagnostics?.invalidCount ?? 0,
      disabledCount: discoveryDiagnostics?.disabledCount ?? 0,
      notYetActiveCount: discoveryDiagnostics?.notYetActiveCount ?? 0,
      expiredCount: discoveryDiagnostics?.expiredCount ?? 0,
      brokenRoutingCount: 0,
      reasonCounts: mapReasonCounts(discoveryIssues.flatMap((issue) => issue.reasonCodes)),
    },
    collections: {
      totalInput: collectionsDiagnostics?.totalInput ?? collectionsValidation.items.length,
      validCount: collectionsDiagnostics?.validCount ?? collectionsValidation.items.length,
      invalidCount: collectionsDiagnostics?.invalidCount ?? 0,
      disabledCount: collectionsDiagnostics?.disabledCount ?? 0,
      notYetActiveCount: collectionsDiagnostics?.notYetActiveCount ?? 0,
      expiredCount: collectionsDiagnostics?.expiredCount ?? 0,
      brokenRoutingCount: 0,
      reasonCounts: mapReasonCounts(collectionsIssues.flatMap((issue) => issue.reasonCodes)),
    },
    coverage,
    invalidEntries,
  };
}
