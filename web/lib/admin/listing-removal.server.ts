import type { SupabaseClient } from "@supabase/supabase-js";

export type ListingRemovalDependencyCount = {
  key: string;
  label: string;
  count: number;
};

export type ListingRemovalDependencySummary = {
  protected: ListingRemovalDependencyCount[];
  cleanup: ListingRemovalDependencyCount[];
  protectedCount: number;
  cleanupCount: number;
  errors: string[];
  canPurge: boolean;
};

export type ListingRemovalDependencySummaryById = Record<string, ListingRemovalDependencySummary>;

type DependencyDefinition = {
  key: string;
  label: string;
  table: string;
  column: string;
  group: "protected" | "cleanup";
};

const DEPENDENCIES: DependencyDefinition[] = [
  {
    key: "shortlet_bookings",
    label: "Shortlet bookings",
    table: "shortlet_bookings",
    column: "property_id",
    group: "protected",
  },
  {
    key: "shortlet_payments",
    label: "Shortlet payments",
    table: "shortlet_payments",
    column: "property_id",
    group: "protected",
  },
  {
    key: "message_threads",
    label: "Message threads",
    table: "message_threads",
    column: "property_id",
    group: "protected",
  },
  {
    key: "listing_leads",
    label: "Listing leads",
    table: "listing_leads",
    column: "property_id",
    group: "protected",
  },
  {
    key: "viewing_requests",
    label: "Viewing requests",
    table: "viewing_requests",
    column: "property_id",
    group: "protected",
  },
  {
    key: "agent_commission_agreements",
    label: "Commission agreements",
    table: "agent_commission_agreements",
    column: "listing_id",
    group: "protected",
  },
  {
    key: "featured_purchases",
    label: "Canonical featured purchases",
    table: "featured_purchases",
    column: "property_id",
    group: "protected",
  },
  {
    key: "feature_purchases",
    label: "Legacy featured purchases",
    table: "feature_purchases",
    column: "listing_id",
    group: "protected",
  },
  {
    key: "featured_credit_consumptions",
    label: "Featured credit consumptions",
    table: "featured_credit_consumptions",
    column: "listing_id",
    group: "protected",
  },
  {
    key: "listing_payments",
    label: "Listing payments",
    table: "listing_payments",
    column: "listing_id",
    group: "protected",
  },
  {
    key: "property_request_response_items",
    label: "Property request matches sent",
    table: "property_request_response_items",
    column: "listing_id",
    group: "protected",
  },
  {
    key: "property_images",
    label: "Listing images",
    table: "property_images",
    column: "property_id",
    group: "cleanup",
  },
  {
    key: "property_videos",
    label: "Listing videos",
    table: "property_videos",
    column: "property_id",
    group: "cleanup",
  },
  {
    key: "shortlet_settings",
    label: "Shortlet settings",
    table: "shortlet_settings",
    column: "property_id",
    group: "cleanup",
  },
  {
    key: "property_share_links",
    label: "Property share links",
    table: "property_share_links",
    column: "property_id",
    group: "cleanup",
  },
  {
    key: "saved_properties",
    label: "Saved favourites",
    table: "saved_properties",
    column: "property_id",
    group: "cleanup",
  },
  {
    key: "saved_collection_items",
    label: "Saved collection items",
    table: "saved_collection_items",
    column: "listing_id",
    group: "cleanup",
  },
  {
    key: "property_events",
    label: "Analytics events",
    table: "property_events",
    column: "property_id",
    group: "cleanup",
  },
  {
    key: "property_checkins",
    label: "Check-in telemetry",
    table: "property_checkins",
    column: "property_id",
    group: "cleanup",
  },
];

function buildEmptySummary(): ListingRemovalDependencySummary {
  return {
    protected: [],
    cleanup: [],
    protectedCount: 0,
    cleanupCount: 0,
    errors: [],
    canPurge: true,
  };
}

type DependencyRow = Record<string, unknown>;

async function countDependencyRowsForListings(
  client: SupabaseClient,
  dependency: DependencyDefinition,
  listingIds: string[]
): Promise<{ ok: true; counts: Map<string, number> } | { ok: false; error: string }> {
  const counts = new Map(listingIds.map((listingId) => [listingId, 0]));
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const result = await client
      .from(dependency.table)
      .select(dependency.column)
      .in(dependency.column, listingIds)
      .range(from, from + pageSize - 1);

    if (result.error) {
      return {
        ok: false,
        error: `${dependency.label}: ${result.error.message}`,
      };
    }

    const rows = ((result.data ?? []) as unknown) as DependencyRow[];
    for (const row of rows) {
      const listingId = row[dependency.column];
      if (typeof listingId !== "string" || !counts.has(listingId)) continue;
      counts.set(listingId, (counts.get(listingId) ?? 0) + 1);
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return { ok: true, counts };
}

export async function getListingRemovalDependencySummary({
  client,
  listingId,
}: {
  client: SupabaseClient;
  listingId: string;
}): Promise<ListingRemovalDependencySummary> {
  const summaries = await getListingRemovalDependencySummaries({
    client,
    listingIds: [listingId],
  });
  return summaries[listingId] ?? buildEmptySummary();
}

export async function getListingRemovalDependencySummaries({
  client,
  listingIds,
}: {
  client: SupabaseClient;
  listingIds: string[];
}): Promise<ListingRemovalDependencySummaryById> {
  const ids = Array.from(new Set(listingIds.filter(Boolean)));
  if (!ids.length) return {};

  const summaries = Object.fromEntries(ids.map((id) => [id, buildEmptySummary()])) as ListingRemovalDependencySummaryById;
  for (const dependency of DEPENDENCIES) {
    const result = await countDependencyRowsForListings(client, dependency, ids);
    for (const listingId of ids) {
      const summary = summaries[listingId];
      const target = dependency.group === "protected" ? summary.protected : summary.cleanup;

      if (!result.ok) {
        summary.errors.push(result.error);
        target.push({ key: dependency.key, label: dependency.label, count: 0 });
        continue;
      }

      target.push({
        key: dependency.key,
        label: dependency.label,
        count: result.counts.get(listingId) ?? 0,
      });
    }
  }

  for (const listingId of ids) {
    const summary = summaries[listingId];
    summary.protectedCount = summary.protected.reduce((sum, row) => sum + row.count, 0);
    summary.cleanupCount = summary.cleanup.reduce((sum, row) => sum + row.count, 0);
    summary.canPurge = summary.errors.length === 0 && summary.protectedCount === 0;
  }

  return summaries;
}
