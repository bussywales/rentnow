import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveListingSocialProof, type ListingSocialProof } from "@/lib/properties/listing-trust-badges";

type PropertyEventRow = {
  property_id: string;
  event_type: string;
  occurred_at?: string | null;
  meta?: Record<string, unknown> | null;
};

export type ListingPopularitySignal = ListingSocialProof & {
  views7: number;
  saves7: number;
  views30: number;
  saves30: number;
};

function defaultSignal(): ListingPopularitySignal {
  return {
    popular: false,
    savedBucket: null,
    viewBucket: null,
    views7: 0,
    saves7: 0,
    views30: 0,
    saves30: 0,
  };
}

function toMillis(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

export async function getListingPopularitySignals(input: {
  listingIds: string[];
  now?: Date;
  client?: SupabaseClient;
}): Promise<Record<string, ListingPopularitySignal>> {
  const ids = Array.from(new Set(input.listingIds.filter(Boolean)));
  if (!ids.length) return {};

  const now = input.now ?? new Date();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since7Ms = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  const supabase =
    input.client ??
    (hasServiceRoleEnv()
      ? createServiceRoleClient()
      : await createServerSupabaseClient());

  const { data, error } = await supabase
    .from("property_events")
    .select("property_id,event_type,occurred_at,meta")
    .in("property_id", ids)
    .in("event_type", ["property_view", "save_toggle"])
    .gte("occurred_at", since30);

  if (error) {
    return ids.reduce<Record<string, ListingPopularitySignal>>((acc, listingId) => {
      acc[listingId] = defaultSignal();
      return acc;
    }, {});
  }

  const counters = new Map<
    string,
    {
      views7: number;
      saves7: number;
      views30: number;
      saves30: number;
      score7: number;
    }
  >();

  for (const listingId of ids) {
    counters.set(listingId, { views7: 0, saves7: 0, views30: 0, saves30: 0, score7: 0 });
  }

  for (const row of ((data as PropertyEventRow[] | null) ?? [])) {
    const listingId = row.property_id;
    if (!listingId || !counters.has(listingId)) continue;

    const bucket = counters.get(listingId)!;
    const occurredAtMs = toMillis(row.occurred_at);
    const within7Days = occurredAtMs !== null && occurredAtMs >= since7Ms;

    if (row.event_type === "property_view") {
      bucket.views30 += 1;
      if (within7Days) bucket.views7 += 1;
      continue;
    }

    if (row.event_type === "save_toggle") {
      const action = String((row.meta as { action?: unknown } | null)?.action ?? "").toLowerCase();
      if (action !== "save") continue;
      bucket.saves30 += 1;
      if (within7Days) bucket.saves7 += 1;
    }
  }

  const scored = ids
    .map((listingId) => {
      const bucket = counters.get(listingId)!;
      const score7 = bucket.views7 + bucket.saves7 * 4;
      bucket.score7 = score7;
      return { listingId, score7 };
    })
    .filter((item) => item.score7 > 0)
    .sort((a, b) => b.score7 - a.score7);

  const popularCutoff = Math.min(10, Math.max(1, Math.ceil(ids.length * 0.2)));
  const popularSet = new Set(
    scored.filter((entry, index) => index < popularCutoff && entry.score7 >= 3).map((entry) => entry.listingId)
  );

  return ids.reduce<Record<string, ListingPopularitySignal>>((acc, listingId) => {
    const bucket = counters.get(listingId) ?? {
      views7: 0,
      saves7: 0,
      views30: 0,
      saves30: 0,
      score7: 0,
    };
    const proof = resolveListingSocialProof({
      savedCount: bucket.saves30,
      viewCount: bucket.views30,
      popular: popularSet.has(listingId),
    });
    acc[listingId] = {
      ...proof,
      views7: bucket.views7,
      saves7: bucket.saves7,
      views30: bucket.views30,
      saves30: bucket.saves30,
    };
    return acc;
  }, {});
}
