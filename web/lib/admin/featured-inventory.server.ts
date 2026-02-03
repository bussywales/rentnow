import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildFeaturedInventorySummary,
  type FeaturedInventoryItem,
  type FeaturedInventorySummary,
} from "@/lib/admin/featured-inventory";
import { buildSummaryByProperty, fetchPropertyEvents } from "@/lib/analytics/property-events.server";

export async function getFeaturedInventorySummary({
  client,
  expiringWindowDays = 7,
}: {
  client: SupabaseClient;
  expiringWindowDays?: number;
}): Promise<FeaturedInventorySummary> {
  const { data, error } = await client
    .from("properties")
    .select("id,title,city,status,featured_rank,featured_until,updated_at")
    .eq("is_featured", true);

  if (error) {
    throw error;
  }

  const rows = (data as FeaturedInventoryItem[]) ?? [];
  if (!rows.length) {
    return buildFeaturedInventorySummary(rows, new Date(), expiringWindowDays);
  }

  let summaryMap = new Map();
  try {
    const { rows: eventRows } = await fetchPropertyEvents({
      propertyIds: rows.map((row) => row.id),
      sinceDays: 7,
      client,
    });
    summaryMap = buildSummaryByProperty(eventRows);
  } catch {
    summaryMap = new Map();
  }

  const enriched = rows.map((row) => {
    const summary = summaryMap.get(row.id);
    const impressions = summary?.featuredImpressions ?? 0;
    const clicks = summary?.featuredClicks ?? 0;
    const leads = summary?.featuredLeads ?? 0;
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : null;
    return {
      ...row,
      featured_impressions_7d: impressions,
      featured_clicks_7d: clicks,
      featured_leads_7d: leads,
      featured_ctr_7d: ctr,
    };
  });

  return buildFeaturedInventorySummary(enriched, new Date(), expiringWindowDays);
}
