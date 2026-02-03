import type { SupabaseClient } from "@supabase/supabase-js";

type MessageRow = {
  property_id: string;
  sender_id: string;
  recipient_id: string | null;
  created_at: string | null;
  properties?: { owner_id: string }[] | null;
};

type ThreadEntry = {
  firstTenantAt: string | null;
  firstHostAt: string | null;
};

const DEFAULT_DAYS = 30;
const DEFAULT_MAX_THREADS = 5;
const DEFAULT_MIN_THREADS = 2;
const RESPONSE_WINDOW_HOURS = 24;

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export async function getFastResponderByHostIds({
  supabase,
  hostIds,
  days = DEFAULT_DAYS,
  maxThreads = DEFAULT_MAX_THREADS,
  minThreads = DEFAULT_MIN_THREADS,
}: {
  supabase: SupabaseClient;
  hostIds: string[];
  days?: number;
  maxThreads?: number;
  minThreads?: number;
}): Promise<Record<string, boolean>> {
  const uniqueHosts = Array.from(new Set(hostIds.filter(Boolean)));
  if (!uniqueHosts.length) return {};

  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("messages")
    .select("property_id, sender_id, recipient_id, created_at, properties!inner(owner_id)")
    .in("properties.owner_id", uniqueHosts)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(1200);

  if (error || !data) return {};

  const rows = data as MessageRow[];
  const threadsByHost = new Map<string, Map<string, ThreadEntry>>();

  rows.forEach((row) => {
    const ownerId = row.properties?.[0]?.owner_id;
    if (!ownerId || !row.created_at) return;
    const tenantId = row.sender_id === ownerId ? row.recipient_id : row.sender_id;
    if (!tenantId) return;

    const threadKey = `${row.property_id}:${tenantId}`;
    let hostThreads = threadsByHost.get(ownerId);
    if (!hostThreads) {
      hostThreads = new Map<string, ThreadEntry>();
      threadsByHost.set(ownerId, hostThreads);
    }

    const entry = hostThreads.get(threadKey) ?? {
      firstTenantAt: null,
      firstHostAt: null,
    };

    if (row.sender_id !== ownerId) {
      if (!entry.firstTenantAt) entry.firstTenantAt = row.created_at;
    } else if (entry.firstTenantAt && !entry.firstHostAt) {
      entry.firstHostAt = row.created_at;
    }

    hostThreads.set(threadKey, entry);
  });

  const result: Record<string, boolean> = {};

  uniqueHosts.forEach((hostId) => {
    const threadMap = threadsByHost.get(hostId);
    if (!threadMap) return;
    const threads = Array.from(threadMap.values())
      .filter((entry) => entry.firstTenantAt)
      .sort((a, b) => {
        const aTime = a.firstTenantAt ? Date.parse(a.firstTenantAt) : 0;
        const bTime = b.firstTenantAt ? Date.parse(b.firstTenantAt) : 0;
        return bTime - aTime;
      })
      .slice(0, maxThreads);

    const responded = threads.filter((entry) => entry.firstTenantAt && entry.firstHostAt);
    if (responded.length < minThreads) return;

    const responseHours = responded
      .map((entry) => {
        if (!entry.firstTenantAt || !entry.firstHostAt) return null;
        const diffMs =
          new Date(entry.firstHostAt).getTime() - new Date(entry.firstTenantAt).getTime();
        if (diffMs < 0) return null;
        return diffMs / (1000 * 60 * 60);
      })
      .filter((value): value is number => typeof value === "number");

    const responseMedian = median(responseHours);
    if (responseMedian !== null && responseMedian <= RESPONSE_WINDOW_HOURS) {
      result[hostId] = true;
    }
  });

  return result;
}
