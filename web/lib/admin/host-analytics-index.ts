import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveAnalyticsRange,
  type AnalyticsRange,
  type AnalyticsRangeKey,
} from "@/lib/analytics/landlord-analytics";
import { formatOwnerLabel } from "@/lib/admin/affected-listings";

type HostProfileRow = {
  id: string;
  role: "landlord" | "agent" | string | null;
  full_name: string | null;
  business_name: string | null;
};

type PropertyRow = {
  owner_id: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type MessageRow = {
  property_id: string;
  sender_id: string;
  recipient_id: string | null;
  created_at: string | null;
  properties?: Array<{ owner_id: string }> | null;
};

type ViewRow = {
  created_at: string | null;
  properties?: Array<{ owner_id: string }> | null;
};

export type HostAnalyticsIndexRow = {
  id: string;
  shortId: string;
  role: "landlord" | "agent" | "unknown";
  label: string;
  listings: number | null;
  enquiries: number | null;
  views: number | null;
  enquiriesAvailable: boolean;
  viewsAvailable: boolean;
  lastActivity: string | null;
};

export type HostAnalyticsIndexSnapshot = {
  range: AnalyticsRange;
  hosts: HostAnalyticsIndexRow[];
  availability: {
    enquiries: boolean;
    views: boolean;
  };
  error: string | null;
};

export type HostAnalyticsIndexMetrics = {
  listingsCount: number | null;
  enquiriesCount: number | null;
  viewsCount: number | null;
  enquiriesAvailable: boolean;
  viewsAvailable: boolean;
  lastActivity: string | null;
};

const SHORT_ID_LEN = 8;

const toShortId = (value: string) => `${value.slice(0, SHORT_ID_LEN)}...`;

const maxIso = (...values: Array<string | null | undefined>) => {
  const dates = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value));
  if (!dates.length) return null;
  const maxDate = dates.reduce((max, current) => (current > max ? current : max));
  return maxDate.toISOString();
};

export function buildHostAnalyticsRow(
  profile: HostProfileRow,
  metrics: HostAnalyticsIndexMetrics
): HostAnalyticsIndexRow {
  const label = formatOwnerLabel(profile.id, profile);
  const role =
    profile.role === "landlord" || profile.role === "agent" ? profile.role : "unknown";

  return {
    id: profile.id,
    shortId: toShortId(profile.id),
    role,
    label,
    listings: metrics.listingsCount,
    enquiries: metrics.enquiriesAvailable ? metrics.enquiriesCount : null,
    views: metrics.viewsAvailable ? metrics.viewsCount : null,
    enquiriesAvailable: metrics.enquiriesAvailable,
    viewsAvailable: metrics.viewsAvailable,
    lastActivity: metrics.lastActivity,
  };
}

export async function buildHostAnalyticsIndex(
  adminClient: SupabaseClient,
  rangeKey?: AnalyticsRangeKey | null
): Promise<HostAnalyticsIndexSnapshot> {
  const range = resolveAnalyticsRange(rangeKey ?? "last7");
  const errors: string[] = [];

  const { data: profiles, error: profilesError } = await adminClient
    .from("profiles")
    .select("id, role, full_name, business_name")
    .in("role", ["landlord", "agent"])
    .order("id", { ascending: true });

  if (profilesError) {
    return {
      range,
      hosts: [],
      availability: { enquiries: false, views: false },
      error: profilesError.message,
    };
  }

  const hostProfiles = (profiles as HostProfileRow[] | null) ?? [];
  const hostIds = hostProfiles.map((profile) => profile.id);

  if (!hostIds.length) {
    return {
      range,
      hosts: [],
      availability: { enquiries: false, views: false },
      error: null,
    };
  }

  const { data: propertyRows, error: propertiesError } = await adminClient
    .from("properties")
    .select("owner_id, updated_at, created_at")
    .in("owner_id", hostIds);

  if (propertiesError) {
    errors.push(`properties: ${propertiesError.message}`);
  }

  const listingsCount = new Map<string, number>();
  const lastPropertyActivity = new Map<string, string>();

  ((propertyRows as PropertyRow[] | null) ?? []).forEach((row) => {
    if (!row.owner_id) return;
    listingsCount.set(row.owner_id, (listingsCount.get(row.owner_id) ?? 0) + 1);
    const activity = maxIso(lastPropertyActivity.get(row.owner_id) ?? null, row.updated_at, row.created_at);
    if (activity) lastPropertyActivity.set(row.owner_id, activity);
  });

  const { data: messageRows, error: messagesError } = await adminClient
    .from("messages")
    .select("property_id, sender_id, recipient_id, created_at, properties!inner(owner_id)")
    .in("properties.owner_id", hostIds)
    .gte("created_at", range.start)
    .lt("created_at", range.end);

  const enquiriesAvailable = !messagesError;
  if (messagesError) {
    errors.push(`messages: ${messagesError.message}`);
  }

  const enquiriesCount = new Map<string, number>();
  const lastMessageActivity = new Map<string, string>();

  if (enquiriesAvailable) {
    const threadSets = new Map<string, Set<string>>();
    ((messageRows as MessageRow[] | null) ?? []).forEach((row) => {
      const ownerId = row.properties?.[0]?.owner_id;
      if (!ownerId) return;
      const tenantId = row.sender_id === ownerId ? row.recipient_id : row.sender_id;
      if (!tenantId) return;
      const threadKey = `${row.property_id}:${tenantId}`;
      const existing = threadSets.get(ownerId) ?? new Set<string>();
      existing.add(threadKey);
      threadSets.set(ownerId, existing);
      const activity = maxIso(lastMessageActivity.get(ownerId) ?? null, row.created_at);
      if (activity) lastMessageActivity.set(ownerId, activity);
    });

    threadSets.forEach((threads, ownerId) => {
      enquiriesCount.set(ownerId, threads.size);
    });
  }

  const { data: viewRows, error: viewsError } = await adminClient
    .from("property_views")
    .select("created_at, properties!inner(owner_id)")
    .in("properties.owner_id", hostIds)
    .gte("created_at", range.start)
    .lt("created_at", range.end);

  const viewsAvailable = !viewsError;
  if (viewsError) {
    errors.push(`property_views: ${viewsError.message}`);
  }

  const viewsCount = new Map<string, number>();

  if (viewsAvailable) {
    ((viewRows as ViewRow[] | null) ?? []).forEach((row) => {
      const ownerId = row.properties?.[0]?.owner_id;
      if (!ownerId) return;
      viewsCount.set(ownerId, (viewsCount.get(ownerId) ?? 0) + 1);
    });
  }

  const hosts = hostProfiles.map((profile) =>
    buildHostAnalyticsRow(profile, {
      listingsCount: propertiesError ? null : listingsCount.get(profile.id) ?? 0,
      enquiriesCount: enquiriesCount.get(profile.id) ?? 0,
      viewsCount: viewsCount.get(profile.id) ?? 0,
      enquiriesAvailable,
      viewsAvailable,
      lastActivity: maxIso(
        lastPropertyActivity.get(profile.id) ?? null,
        lastMessageActivity.get(profile.id) ?? null
      ),
    })
  );

  return {
    range,
    hosts,
    availability: { enquiries: enquiriesAvailable, views: viewsAvailable },
    error: errors.length ? errors.join(" | ") : null,
  };
}
