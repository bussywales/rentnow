import type { SupabaseClient } from "@supabase/supabase-js";

export type CreditSummary = {
  listingRemaining: number;
  listingTotal: number;
  featuredRemaining: number;
  featuredTotal: number;
};

type CreditRow = {
  credits_total?: number | null;
  credits_used?: number | null;
  expires_at?: string | null;
};

function calculateRemaining(rows: CreditRow[], nowIso: string) {
  const nowMs = Date.parse(nowIso);
  return rows.reduce(
    (acc, row) => {
      const expiresAt = row.expires_at ? Date.parse(row.expires_at) : null;
      if (expiresAt && Number.isFinite(expiresAt) && expiresAt <= nowMs) {
        return acc;
      }
      const total = Math.max(0, row.credits_total ?? 0);
      const used = Math.max(0, row.credits_used ?? 0);
      acc.total += total;
      acc.remaining += Math.max(0, total - used);
      return acc;
    },
    { total: 0, remaining: 0 }
  );
}

export async function getCreditSummary({
  supabase,
  userId,
  nowIso,
}: {
  supabase: SupabaseClient;
  userId: string;
  nowIso?: string;
}): Promise<CreditSummary> {
  const now = nowIso ?? new Date().toISOString();
  const [listingRes, featuredRes] = await Promise.all([
    supabase
      .from("listing_credits")
      .select("credits_total, credits_used, expires_at")
      .eq("user_id", userId),
    supabase
      .from("featured_credits")
      .select("credits_total, credits_used, expires_at")
      .eq("user_id", userId),
  ]);

  const listingRows = (listingRes.data as CreditRow[] | null) ?? [];
  const featuredRows = (featuredRes.data as CreditRow[] | null) ?? [];
  const listing = calculateRemaining(listingRows, now);
  const featured = calculateRemaining(featuredRows, now);

  return {
    listingRemaining: listing.remaining,
    listingTotal: listing.total,
    featuredRemaining: featured.remaining,
    featuredTotal: featured.total,
  };
}
