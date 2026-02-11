import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applySavedSearchMatchSpecToQuery,
  buildSavedSearchMatchQuerySpec,
  getSavedSearchBaselineIso,
  type SavedSearchLike,
} from "@/lib/saved-searches/matching";

export type SavedSearchSummaryItem = {
  id: string;
  name: string;
  isActive: boolean;
  newMatchesCount: number;
  lastCheckedAt: string | null;
  lastNotifiedAt: string | null;
  createdAt: string | null;
  queryParams: Record<string, unknown>;
};

export type SavedSearchSummaryResponse = {
  totalNewMatches: number;
  searches: SavedSearchSummaryItem[];
};

type SavedSearchRow = {
  id: string;
  name: string;
  query_params: Record<string, unknown> | null;
  is_active?: boolean | null;
  created_at?: string | null;
  last_checked_at?: string | null;
  last_notified_at?: string | null;
};

async function countMatchesSince(input: {
  supabase: SupabaseClient;
  search: SavedSearchLike;
}) {
  const filters = input.search.query_params || {};
  const spec = buildSavedSearchMatchQuerySpec({
    filters,
    sinceIso: getSavedSearchBaselineIso(input.search),
  });

  let query = input.supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("is_approved", true)
    .eq("is_active", true)
    .eq("status", "live")
    .eq("is_demo", false)
    .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`);

  query = applySavedSearchMatchSpecToQuery(query, spec);
  const { count, error } = await query;
  if (error) return 0;
  return Math.max(0, count ?? 0);
}

export async function getSavedSearchSummaryForUser(input: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<SavedSearchSummaryResponse> {
  const { data, error } = await input.supabase
    .from("saved_searches")
    .select("id,name,query_params,is_active,created_at,last_checked_at,last_notified_at")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const searches = ((data as unknown as SavedSearchRow[] | null) ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    queryParams: row.query_params || {},
    isActive: row.is_active !== false,
    createdAt: row.created_at ?? null,
    lastCheckedAt: row.last_checked_at ?? null,
    lastNotifiedAt: row.last_notified_at ?? null,
  }));

  if (!searches.length) {
    return { totalNewMatches: 0, searches: [] };
  }

  const counts = await Promise.all(
    searches.map(async (search) => {
      if (!search.isActive) return 0;
      return countMatchesSince({
        supabase: input.supabase,
        search: {
          id: search.id,
          name: search.name,
          query_params: search.queryParams,
          created_at: search.createdAt,
          last_checked_at: search.lastCheckedAt,
          last_notified_at: search.lastNotifiedAt,
          is_active: search.isActive,
        },
      });
    })
  );

  const summaryItems: SavedSearchSummaryItem[] = searches.map((search, index) => ({
    id: search.id,
    name: search.name,
    isActive: search.isActive,
    newMatchesCount: counts[index] ?? 0,
    lastCheckedAt: search.lastCheckedAt,
    lastNotifiedAt: search.lastNotifiedAt,
    createdAt: search.createdAt,
    queryParams: search.queryParams,
  }));

  summaryItems.sort((a, b) => {
    if (b.newMatchesCount !== a.newMatchesCount) return b.newMatchesCount - a.newMatchesCount;
    return a.name.localeCompare(b.name);
  });

  return {
    totalNewMatches: summaryItems.reduce((sum, item) => sum + item.newMatchesCount, 0),
    searches: summaryItems,
  };
}
