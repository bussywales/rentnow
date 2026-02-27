export const EXPLORE_ANALYTICS_STORAGE_KEY = "ph:explore:analytics:v0_3";
export const EXPLORE_ANALYTICS_MAX_EVENTS = 200;

export type ExploreAnalyticsEventName =
  | "explore_view"
  | "explore_swipe"
  | "explore_open_details"
  | "explore_tap_cta"
  | "explore_save_toggle"
  | "explore_share"
  | "explore_not_interested";

export type ExploreAnalyticsEvent = {
  name: ExploreAnalyticsEventName;
  at: string;
  listingId?: string | null;
  marketCountry?: string | null;
  depth?: number;
  fromIndex?: number;
  toIndex?: number;
  action?: string | null;
  result?: string | null;
};

type ExploreAnalyticsPayload = {
  events: ExploreAnalyticsEvent[];
};

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function parseExploreAnalyticsPayload(raw: string | null | undefined): ExploreAnalyticsPayload {
  if (!raw) return { events: [] };
  try {
    const parsed = JSON.parse(raw) as { events?: unknown } | null;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.events)) {
      return { events: [] };
    }
    const events = parsed.events
      .filter((event) => event && typeof event === "object")
      .map((event) => {
        const typed = event as Record<string, unknown>;
        const name = typeof typed.name === "string" ? typed.name : "";
        const at = typeof typed.at === "string" ? typed.at : null;
        if (!name || !at) return null;
        return {
          name: name as ExploreAnalyticsEventName,
          at,
          listingId: typeof typed.listingId === "string" ? typed.listingId : null,
          marketCountry: typeof typed.marketCountry === "string" ? typed.marketCountry : null,
          depth: typeof typed.depth === "number" && Number.isFinite(typed.depth) ? typed.depth : undefined,
          fromIndex:
            typeof typed.fromIndex === "number" && Number.isFinite(typed.fromIndex)
              ? typed.fromIndex
              : undefined,
          toIndex:
            typeof typed.toIndex === "number" && Number.isFinite(typed.toIndex) ? typed.toIndex : undefined,
          action: typeof typed.action === "string" ? typed.action : null,
          result: typeof typed.result === "string" ? typed.result : null,
        } satisfies ExploreAnalyticsEvent;
      })
      .filter((event): event is NonNullable<typeof event> => event !== null);

    return {
      events: events.slice(-EXPLORE_ANALYTICS_MAX_EVENTS),
    };
  } catch {
    return { events: [] };
  }
}

function writeExploreAnalyticsEvents(storage: Storage, events: ExploreAnalyticsEvent[]): ExploreAnalyticsEvent[] {
  const safeEvents = events.slice(-EXPLORE_ANALYTICS_MAX_EVENTS);
  storage.setItem(
    EXPLORE_ANALYTICS_STORAGE_KEY,
    JSON.stringify({
      events: safeEvents,
    })
  );
  return safeEvents;
}

export function getExploreAnalyticsEvents(): ExploreAnalyticsEvent[] {
  const storage = getStorage();
  if (!storage) return [];
  return parseExploreAnalyticsPayload(storage.getItem(EXPLORE_ANALYTICS_STORAGE_KEY)).events;
}

export function clearExploreAnalyticsEvents(): ExploreAnalyticsEvent[] {
  const storage = getStorage();
  if (!storage) return [];
  storage.removeItem(EXPLORE_ANALYTICS_STORAGE_KEY);
  return [];
}

export function recordExploreAnalyticsEvent(
  input: Omit<ExploreAnalyticsEvent, "at"> & {
    at?: string;
  }
): ExploreAnalyticsEvent[] {
  const storage = getStorage();
  if (!storage) return [];
  const existing = parseExploreAnalyticsPayload(storage.getItem(EXPLORE_ANALYTICS_STORAGE_KEY));
  const nextEvent: ExploreAnalyticsEvent = {
    name: input.name,
    at: input.at ?? new Date().toISOString(),
    listingId: input.listingId ?? null,
    marketCountry: input.marketCountry ?? null,
    depth: input.depth,
    fromIndex: input.fromIndex,
    toIndex: input.toIndex,
    action: input.action ?? null,
    result: input.result ?? null,
  };
  return writeExploreAnalyticsEvents(storage, [...existing.events, nextEvent]);
}
