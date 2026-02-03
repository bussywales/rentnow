export const PROPERTY_EVENT_TYPES = [
  "property_view",
  "save_toggle",
  "lead_created",
  "viewing_requested",
  "share_open",
  "featured_impression",
] as const;

export type PropertyEventType = (typeof PROPERTY_EVENT_TYPES)[number];

export type PropertyEventRow = {
  property_id: string;
  event_type: PropertyEventType | string;
  actor_user_id?: string | null;
  actor_role?: string | null;
  occurred_at?: string | null;
  session_key?: string | null;
  meta?: Record<string, unknown> | null;
};

export type PropertyEventSummary = {
  propertyId: string;
  views: number;
  uniqueViews: number;
  saveToggles: number;
  netSaves: number;
  enquiries: number;
  viewingRequests: number;
  shares: number;
  featuredImpressions: number;
  featuredClicks: number;
  featuredLeads: number;
  lastOccurredAt: string | null;
};

export type MissedDemandEstimate =
  | {
      state: "not_applicable" | "no_history" | "not_enough_data";
      missed: null;
      averageDaily: null;
      liveDays: number;
      daysPaused: number;
    }
  | {
      state: "ok";
      missed: number;
      averageDaily: number;
      liveDays: number;
      daysPaused: number;
    };

const DEMAND_WEIGHTS = {
  uniqueView: 1,
  save: 2,
  lead: 10,
};

function normalizeMeta(meta: PropertyEventRow["meta"]) {
  if (!meta || typeof meta !== "object") return {} as Record<string, unknown>;
  return meta as Record<string, unknown>;
}

function actorKey(row: PropertyEventRow): string | null {
  return row.session_key || row.actor_user_id || null;
}

function normalizeStatus(status?: string | null) {
  return status ? status.toLowerCase().trim() : null;
}

function toDateKey(value: string) {
  return value.slice(0, 10);
}

function toTimestamp(value?: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function buildPropertyEventSummary(rows: PropertyEventRow[]) {
  const summaries = new Map<string, PropertyEventSummary>();
  const uniqueViewers = new Map<string, Set<string>>();
  const featuredClicks = new Map<string, number[]>();
  const leadEvents: Array<{ propertyId: string; actor: string; occurredAt: number }> = [];

  for (const row of rows) {
    const propertyId = row.property_id;
    if (!propertyId) continue;
    if (!summaries.has(propertyId)) {
      summaries.set(propertyId, {
        propertyId,
        views: 0,
        uniqueViews: 0,
        saveToggles: 0,
        netSaves: 0,
        enquiries: 0,
        viewingRequests: 0,
        shares: 0,
        featuredImpressions: 0,
        featuredClicks: 0,
        featuredLeads: 0,
        lastOccurredAt: null,
      });
    }

    const summary = summaries.get(propertyId)!;
    const eventType = row.event_type;
    const meta = normalizeMeta(row.meta);
    const occurredAt = row.occurred_at ?? null;

    if (occurredAt) {
      if (!summary.lastOccurredAt || occurredAt > summary.lastOccurredAt) {
        summary.lastOccurredAt = occurredAt;
      }
    }

    if (eventType === "property_view") {
      summary.views += 1;
      const key = actorKey(row);
      if (key) {
        if (!uniqueViewers.has(propertyId)) {
          uniqueViewers.set(propertyId, new Set());
        }
        uniqueViewers.get(propertyId)!.add(key);
      }
      if (meta.source === "featured") {
        summary.featuredClicks += 1;
        const key = actorKey(row);
        const ts = toTimestamp(occurredAt);
        if (key && typeof ts === "number") {
          const mapKey = `${propertyId}:${key}`;
          const list = featuredClicks.get(mapKey) ?? [];
          list.push(ts);
          featuredClicks.set(mapKey, list);
        }
      }
      continue;
    }

    if (eventType === "save_toggle") {
      summary.saveToggles += 1;
      if (meta.action === "save") summary.netSaves += 1;
      if (meta.action === "unsave") summary.netSaves -= 1;
      continue;
    }

    if (eventType === "lead_created") {
      summary.enquiries += 1;
      const key = actorKey(row);
      const ts = toTimestamp(occurredAt);
      if (key && typeof ts === "number") {
        leadEvents.push({ propertyId, actor: key, occurredAt: ts });
      }
      continue;
    }

    if (eventType === "viewing_requested") {
      summary.viewingRequests += 1;
      const key = actorKey(row);
      const ts = toTimestamp(occurredAt);
      if (key && typeof ts === "number") {
        leadEvents.push({ propertyId, actor: key, occurredAt: ts });
      }
      continue;
    }

    if (eventType === "share_open") {
      summary.shares += 1;
      continue;
    }

    if (eventType === "featured_impression") {
      summary.featuredImpressions += 1;
      continue;
    }
  }

  for (const [propertyId, set] of uniqueViewers) {
    const summary = summaries.get(propertyId);
    if (summary) summary.uniqueViews = set.size;
  }

  if (featuredClicks.size && leadEvents.length) {
    for (const [, list] of featuredClicks) {
      list.sort((a, b) => a - b);
    }
    const windowMs = 30 * 60 * 1000;
    for (const lead of leadEvents) {
      const mapKey = `${lead.propertyId}:${lead.actor}`;
      const clicks = featuredClicks.get(mapKey);
      if (!clicks?.length) continue;
      const lowerBound = lead.occurredAt - windowMs;
      const matched = clicks.some((ts) => ts >= lowerBound && ts <= lead.occurredAt);
      if (matched) {
        const summary = summaries.get(lead.propertyId);
        if (summary) summary.featuredLeads += 1;
      }
    }
  }

  return summaries;
}

export function estimateMissedDemand(input: {
  listing: {
    status?: string | null;
    paused_at?: string | null;
    status_updated_at?: string | null;
    expires_at?: string | null;
    expired_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  events: PropertyEventRow[];
  now?: Date;
}): MissedDemandEstimate {
  const { listing, events } = input;
  const status = normalizeStatus(listing.status);
  const now = input.now ?? new Date();
  const paused = status === "paused" || status === "paused_owner" || status === "paused_occupied";
  const expired = status === "expired";

  if (!paused && !expired) {
    return {
      state: "not_applicable",
      missed: null,
      averageDaily: null,
      liveDays: 0,
      daysPaused: 0,
    };
  }

  const pauseStartIso =
    (paused && listing.paused_at) ||
    (expired && (listing.expires_at || listing.expired_at)) ||
    listing.status_updated_at ||
    listing.updated_at ||
    listing.created_at ||
    null;

  const pauseStart = pauseStartIso ? new Date(pauseStartIso) : null;
  if (!pauseStart || Number.isNaN(pauseStart.getTime())) {
    return {
      state: "no_history",
      missed: null,
      averageDaily: null,
      liveDays: 0,
      daysPaused: 0,
    };
  }

  const diffMs = now.getTime() - pauseStart.getTime();
  const daysPaused = diffMs > 0 ? Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000))) : 0;

  const historyEnd = pauseStart.getTime();
  const historyStart = historyEnd - 14 * 24 * 60 * 60 * 1000;

  const daily = new Map<
    string,
    {
      uniqueViews: Set<string>;
      saves: number;
      leads: number;
    }
  >();

  for (const row of events) {
    const occurredAt = toTimestamp(row.occurred_at);
    if (typeof occurredAt !== "number") continue;
    if (occurredAt >= historyEnd || occurredAt < historyStart) continue;
    const dayKey = toDateKey(new Date(occurredAt).toISOString());
    if (!daily.has(dayKey)) {
      daily.set(dayKey, { uniqueViews: new Set(), saves: 0, leads: 0 });
    }
    const bucket = daily.get(dayKey)!;
    const eventType = row.event_type;
    const meta = normalizeMeta(row.meta);
    if (eventType === "property_view") {
      const key = actorKey(row);
      if (key) bucket.uniqueViews.add(key);
    } else if (eventType === "save_toggle") {
      if (meta.action === "save") bucket.saves += 1;
    } else if (eventType === "lead_created" || eventType === "viewing_requested") {
      bucket.leads += 1;
    }
  }

  const liveDays = daily.size;
  if (liveDays === 0) {
    return {
      state: "no_history",
      missed: null,
      averageDaily: null,
      liveDays,
      daysPaused,
    };
  }

  if (liveDays < 3) {
    return {
      state: "not_enough_data",
      missed: null,
      averageDaily: null,
      liveDays,
      daysPaused,
    };
  }

  let totalDemand = 0;
  for (const bucket of daily.values()) {
    totalDemand +=
      bucket.uniqueViews.size * DEMAND_WEIGHTS.uniqueView +
      bucket.saves * DEMAND_WEIGHTS.save +
      bucket.leads * DEMAND_WEIGHTS.lead;
  }

  const averageDaily = totalDemand / liveDays;
  const missed = Math.round(averageDaily * daysPaused);

  return {
    state: "ok",
    missed,
    averageDaily,
    liveDays,
    daysPaused,
  };
}
