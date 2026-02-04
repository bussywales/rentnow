import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { buildSummaryByProperty, filterRowsSince, fetchPropertyEvents } from "@/lib/analytics/property-events.server";
import type { PropertyEventRow } from "@/lib/analytics/property-events";

const DAY_MS = 24 * 60 * 60 * 1000;

export const HOST_PERFORMANCE_RANGES = [7, 30, 90] as const;
export type HostPerformanceRange = (typeof HOST_PERFORMANCE_RANGES)[number];

export type HostPerformanceListing = {
  id: string;
  owner_id: string;
  title?: string | null;
  city?: string | null;
  status?: string | null;
  listing_intent?: string | null;
  created_at?: string | null;
  approved_at?: string | null;
  updated_at?: string | null;
};

export type HostPerformanceRow = {
  id: string;
  title: string;
  city: string;
  status: string | null;
  listing_intent: string | null;
  views: number;
  saves: number;
  enquiries: number;
  daysLive: number;
  leadRate: number;
  updatedAt: string | null;
};

export function resolveHostPerformanceRange(value?: string | null): HostPerformanceRange {
  const parsed = Number(value ?? "");
  if (HOST_PERFORMANCE_RANGES.includes(parsed as HostPerformanceRange)) {
    return parsed as HostPerformanceRange;
  }
  return 30;
}

function resolveDaysLive(listing: HostPerformanceListing, now = new Date()) {
  const anchor =
    listing.approved_at ||
    listing.created_at ||
    listing.updated_at ||
    null;
  if (!anchor) return 0;
  const anchorMs = Date.parse(anchor);
  if (Number.isNaN(anchorMs)) return 0;
  const diff = Math.max(0, now.getTime() - anchorMs);
  return Math.max(0, Math.ceil(diff / DAY_MS));
}

function clampNetSaves(value: number) {
  return Math.max(value, 0);
}

export function computeHostPerformanceRows({
  listings,
  events,
  now = new Date(),
  rangeDays,
}: {
  listings: HostPerformanceListing[];
  events: PropertyEventRow[];
  now?: Date;
  rangeDays: HostPerformanceRange;
}): HostPerformanceRow[] {
  const sinceIso = new Date(now.getTime() - rangeDays * DAY_MS).toISOString();
  const filteredEvents = filterRowsSince(events, sinceIso);
  const summaries = buildSummaryByProperty(filteredEvents);

  return listings.map((listing) => {
    const summary = summaries.get(listing.id);
    const views = summary?.views ?? 0;
    const saves = clampNetSaves(summary?.netSaves ?? 0);
    const enquiries = (summary?.enquiries ?? 0) + (summary?.viewingRequests ?? 0);
    const leadRate = enquiries / Math.max(views, 1);

    return {
      id: listing.id,
      title: listing.title || "Untitled listing",
      city: listing.city || "Unknown city",
      status: listing.status ?? null,
      listing_intent: listing.listing_intent ?? null,
      views,
      saves,
      enquiries,
      daysLive: resolveDaysLive(listing, now),
      leadRate,
      updatedAt: listing.updated_at ?? null,
    };
  });
}

export async function fetchHostPerformanceRows({
  supabase,
  ownerId,
  rangeDays,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  ownerId: string;
  rangeDays: HostPerformanceRange;
  now?: Date;
}) {
  const { data, error } = await supabase
    .from("properties")
    .select("id, owner_id, title, city, status, listing_intent, created_at, approved_at, updated_at")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });

  if (error) {
    return { rows: [] as HostPerformanceRow[], error: error.message };
  }

  const listings = (data as HostPerformanceListing[]) || [];
  const propertyIds = listings.map((listing) => listing.id);
  if (!propertyIds.length) {
    return { rows: [] as HostPerformanceRow[], error: null };
  }

  const eventClient = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  const { rows, error: eventsError } = await fetchPropertyEvents({
    propertyIds,
    sinceDays: rangeDays,
    client: eventClient,
  });

  if (eventsError) {
    return { rows: [] as HostPerformanceRow[], error: eventsError };
  }

  return {
    rows: computeHostPerformanceRows({
      listings,
      events: rows,
      now,
      rangeDays,
    }),
    error: null,
  };
}
