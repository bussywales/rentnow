import type { DiscoveryCatalogueItem } from "@/lib/discovery";
import {
  buildPropertiesFeaturedHref,
  buildShortletsFeaturedHref,
} from "@/lib/discovery";
import type { StaticCollectionDefinition } from "@/lib/collections/collections-registry";
import { buildCollectionResultsHref } from "@/lib/collections/collections-select";

export const BROKEN_ROUTE_REASON_CODES = [
  "BROKEN_HREF_PREFIX",
  "MISSING_REQUIRED_PARAM",
  "UNKNOWN_COLLECTION_SLUG",
  "INVALID_QUERY_PARAM_FORMAT",
] as const;

export type BrokenRouteReasonCode = (typeof BROKEN_ROUTE_REASON_CODES)[number];

export type BrokenRouteIssue = {
  source: "discovery" | "collections";
  id: string;
  routeLabel: string;
  href: string;
  reasonCode: BrokenRouteReasonCode;
  details: string;
};

function parseHref(href: string): URL | null {
  if (!href || typeof href !== "string") return null;
  try {
    return new URL(href, "https://www.propatyhub.test");
  } catch {
    return null;
  }
}

function hasAllowedPrefix(pathname: string, expectedPrefix: "/shortlets" | "/properties" | "/collections"): boolean {
  if (pathname === expectedPrefix) return true;
  return pathname.startsWith(`${expectedPrefix}/`);
}

function pushIssue(
  target: BrokenRouteIssue[],
  issue: Omit<BrokenRouteIssue, "reasonCode" | "details"> & {
    reasonCode: BrokenRouteReasonCode;
    details: string;
  }
) {
  target.push(issue);
}

function validateShortletsParams(
  url: URL,
  issueBase: Omit<BrokenRouteIssue, "reasonCode" | "details">,
  target: BrokenRouteIssue[]
) {
  const guests = url.searchParams.get("guests");
  if (!guests) {
    pushIssue(target, {
      ...issueBase,
      reasonCode: "MISSING_REQUIRED_PARAM",
      details: "shortlets route missing guests param",
    });
  } else if (!/^\d+$/.test(guests) || Number(guests) < 1) {
    pushIssue(target, {
      ...issueBase,
      reasonCode: "INVALID_QUERY_PARAM_FORMAT",
      details: "shortlets guests must be a positive integer",
    });
  }

  const checkIn = url.searchParams.get("checkIn");
  const checkOut = url.searchParams.get("checkOut");
  if ((checkIn && !checkOut) || (!checkIn && checkOut)) {
    pushIssue(target, {
      ...issueBase,
      reasonCode: "MISSING_REQUIRED_PARAM",
      details: "checkIn/checkOut must be provided together",
    });
  }

  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  if ((lat && !lng) || (!lat && lng)) {
    pushIssue(target, {
      ...issueBase,
      reasonCode: "MISSING_REQUIRED_PARAM",
      details: "lat/lng must be provided together",
    });
  }
  if (lat && Number.isNaN(Number(lat))) {
    pushIssue(target, {
      ...issueBase,
      reasonCode: "INVALID_QUERY_PARAM_FORMAT",
      details: "lat must be numeric",
    });
  }
  if (lng && Number.isNaN(Number(lng))) {
    pushIssue(target, {
      ...issueBase,
      reasonCode: "INVALID_QUERY_PARAM_FORMAT",
      details: "lng must be numeric",
    });
  }
}

function validatePropertiesParams(
  url: URL,
  issueBase: Omit<BrokenRouteIssue, "reasonCode" | "details">,
  target: BrokenRouteIssue[]
) {
  if (!url.searchParams.get("category")) {
    pushIssue(target, {
      ...issueBase,
      reasonCode: "MISSING_REQUIRED_PARAM",
      details: "properties route missing category param",
    });
  }
  if (!url.searchParams.get("intent")) {
    pushIssue(target, {
      ...issueBase,
      reasonCode: "MISSING_REQUIRED_PARAM",
      details: "properties route missing intent param",
    });
  }

  const minPrice = url.searchParams.get("minPrice");
  if (minPrice && Number.isNaN(Number(minPrice))) {
    pushIssue(target, {
      ...issueBase,
      reasonCode: "INVALID_QUERY_PARAM_FORMAT",
      details: "minPrice must be numeric",
    });
  }
  const maxPrice = url.searchParams.get("maxPrice");
  if (maxPrice && Number.isNaN(Number(maxPrice))) {
    pushIssue(target, {
      ...issueBase,
      reasonCode: "INVALID_QUERY_PARAM_FORMAT",
      details: "maxPrice must be numeric",
    });
  }
}

function validateCollectionHref(
  url: URL,
  knownSlugs: ReadonlySet<string>,
  issueBase: Omit<BrokenRouteIssue, "reasonCode" | "details">,
  target: BrokenRouteIssue[]
) {
  const slug = url.pathname.split("/").filter(Boolean)[1] ?? "";
  if (!slug) {
    pushIssue(target, {
      ...issueBase,
      reasonCode: "MISSING_REQUIRED_PARAM",
      details: "collection href missing slug",
    });
    return;
  }
  if (!knownSlugs.has(slug)) {
    pushIssue(target, {
      ...issueBase,
      reasonCode: "UNKNOWN_COLLECTION_SLUG",
      details: `collection slug "${slug}" not found in registry`,
    });
  }
}

function validateHref(input: {
  source: BrokenRouteIssue["source"];
  id: string;
  routeLabel: string;
  href: string;
  expectedPrefix: "/shortlets" | "/properties" | "/collections";
  knownCollectionSlugs: ReadonlySet<string>;
}): BrokenRouteIssue[] {
  const issues: BrokenRouteIssue[] = [];
  const issueBase = {
    source: input.source,
    id: input.id,
    routeLabel: input.routeLabel,
    href: input.href,
  } as const;

  const parsed = parseHref(input.href);
  if (!parsed) {
    pushIssue(issues, {
      ...issueBase,
      reasonCode: "INVALID_QUERY_PARAM_FORMAT",
      details: "href could not be parsed as a URL path",
    });
    return issues;
  }

  if (!hasAllowedPrefix(parsed.pathname, input.expectedPrefix)) {
    pushIssue(issues, {
      ...issueBase,
      reasonCode: "BROKEN_HREF_PREFIX",
      details: `expected prefix ${input.expectedPrefix} but received ${parsed.pathname}`,
    });
  }

  if (input.expectedPrefix === "/shortlets") {
    validateShortletsParams(parsed, issueBase, issues);
  } else if (input.expectedPrefix === "/properties") {
    validatePropertiesParams(parsed, issueBase, issues);
  } else {
    validateCollectionHref(parsed, input.knownCollectionSlugs, issueBase, issues);
  }

  const collectionSlugParam =
    parsed.searchParams.get("collection") ?? parsed.searchParams.get("collectionSlug");
  if (collectionSlugParam && !input.knownCollectionSlugs.has(collectionSlugParam)) {
    pushIssue(issues, {
      ...issueBase,
      reasonCode: "UNKNOWN_COLLECTION_SLUG",
      details: `query references unknown collection slug "${collectionSlugParam}"`,
    });
  }

  return issues;
}

function resolveDiscoveryExpectedPrefix(item: DiscoveryCatalogueItem): "/shortlets" | "/properties" {
  return item.kind === "shortlet" || item.intent === "shortlet" ? "/shortlets" : "/properties";
}

function resolveDiscoveryMarketForHref(item: DiscoveryCatalogueItem): string {
  const marketSpecific = item.marketTags.find((tag) => tag !== "GLOBAL");
  return marketSpecific ?? "GLOBAL";
}

function auditCollectionSlugReference(input: {
  source: BrokenRouteIssue["source"];
  id: string;
  routeLabel: string;
  params: Record<string, string>;
  knownCollectionSlugs: ReadonlySet<string>;
}): BrokenRouteIssue[] {
  const slug = (input.params.collectionSlug ?? input.params.collection ?? "").trim();
  if (!slug) return [];
  return validateHref({
    source: input.source,
    id: input.id,
    routeLabel: input.routeLabel,
    href: `/collections/${slug}`,
    expectedPrefix: "/collections",
    knownCollectionSlugs: input.knownCollectionSlugs,
  });
}

export function auditDiscoveryBrokenRoutes(input: {
  discoveryItems: ReadonlyArray<DiscoveryCatalogueItem>;
  collectionsItems: ReadonlyArray<StaticCollectionDefinition>;
  now?: Date;
}): BrokenRouteIssue[] {
  const issues: BrokenRouteIssue[] = [];
  const knownCollectionSlugs = new Set(input.collectionsItems.map((item) => item.slug));

  for (const item of input.discoveryItems) {
    const expectedPrefix = resolveDiscoveryExpectedPrefix(item);
    const href =
      expectedPrefix === "/shortlets"
        ? buildShortletsFeaturedHref({
            item,
            marketCountry: resolveDiscoveryMarketForHref(item),
          })
        : buildPropertiesFeaturedHref(item);

    issues.push(
      ...validateHref({
        source: "discovery",
        id: item.id,
        routeLabel: "featured_item",
        href,
        expectedPrefix,
        knownCollectionSlugs,
      })
    );
    issues.push(
      ...auditCollectionSlugReference({
        source: "discovery",
        id: item.id,
        routeLabel: "collection_reference",
        params: item.params,
        knownCollectionSlugs,
      })
    );
  }

  for (const collection of input.collectionsItems) {
    const collectionPageHref = `/collections/${collection.slug}`;
    issues.push(
      ...validateHref({
        source: "collections",
        id: collection.slug,
        routeLabel: "collection_page",
        href: collectionPageHref,
        expectedPrefix: "/collections",
        knownCollectionSlugs,
      })
    );

    const resultsHref = buildCollectionResultsHref({
      slug: collection.slug,
      marketCountry: collection.marketTags.find((tag) => tag !== "ALL") ?? "GLOBAL",
      now: input.now,
    });

    if (!resultsHref) {
      issues.push({
        source: "collections",
        id: collection.slug,
        routeLabel: "collection_results",
        href: "(null)",
        reasonCode: "UNKNOWN_COLLECTION_SLUG",
        details: "collection results href could not be generated for slug",
      });
      continue;
    }

    issues.push(
      ...validateHref({
        source: "collections",
        id: collection.slug,
        routeLabel: "collection_results",
        href: resultsHref,
        expectedPrefix: collection.primaryKind === "shortlet" ? "/shortlets" : "/properties",
        knownCollectionSlugs,
      })
    );
    issues.push(
      ...auditCollectionSlugReference({
        source: "collections",
        id: collection.slug,
        routeLabel: "collection_param_reference",
        params: collection.params,
        knownCollectionSlugs,
      })
    );
  }

  return issues.sort((left, right) => {
    if (left.source !== right.source) return left.source.localeCompare(right.source);
    if (left.id !== right.id) return left.id.localeCompare(right.id);
    if (left.routeLabel !== right.routeLabel) return left.routeLabel.localeCompare(right.routeLabel);
    if (left.reasonCode !== right.reasonCode) return left.reasonCode.localeCompare(right.reasonCode);
    return left.href.localeCompare(right.href);
  });
}
