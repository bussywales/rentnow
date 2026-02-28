export const EXPLORE_ANALYTICS_STORAGE_KEY = "ph:explore:analytics:v0_3";
export const EXPLORE_ANALYTICS_MAX_EVENTS = 200;
const EXPLORE_ANALYTICS_SESSION_STORAGE_KEY = "ph:explore:analytics:session:v1";
const EXPLORE_ANALYTICS_SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export type ExploreAnalyticsEventName =
  | "explore_view"
  | "explore_swipe"
  | "explore_open_details"
  | "explore_tap_cta"
  | "explore_open_next_steps"
  | "explore_open_request_composer"
  | "explore_submit_request_attempt"
  | "explore_submit_request_success"
  | "explore_submit_request_fail"
  | "explore_continue_booking"
  | "explore_save_toggle"
  | "explore_share"
  | "explore_not_interested";

export type ExploreAnalyticsEvent = {
  name: ExploreAnalyticsEventName;
  at: string;
  sessionId?: string | null;
  listingId?: string | null;
  marketCode?: string | null;
  marketCountry?: string | null;
  intentType?: "shortlet" | "rent" | "buy" | null;
  index?: number;
  feedSize?: number;
  depth?: number;
  fromIndex?: number;
  toIndex?: number;
  action?: string | null;
  result?: string | null;
};

type ExploreAnalyticsPayload = {
  events: ExploreAnalyticsEvent[];
};

type ExploreAnalyticsSessionPayload = {
  id: string;
  lastActivityAt: number;
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
        const parsedIntentType =
          typed.intentType === "shortlet" || typed.intentType === "rent" || typed.intentType === "buy"
            ? typed.intentType
            : null;
        const parsedMarketCode =
          typeof typed.marketCode === "string"
            ? typed.marketCode
            : typeof typed.marketCountry === "string"
              ? typed.marketCountry
              : null;
        return {
          name: name as ExploreAnalyticsEventName,
          at,
          sessionId: typeof typed.sessionId === "string" ? typed.sessionId : null,
          listingId: typeof typed.listingId === "string" ? typed.listingId : null,
          marketCode: parsedMarketCode,
          marketCountry: parsedMarketCode,
          intentType: parsedIntentType,
          index: typeof typed.index === "number" && Number.isFinite(typed.index) ? typed.index : undefined,
          feedSize: typeof typed.feedSize === "number" && Number.isFinite(typed.feedSize) ? typed.feedSize : undefined,
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

function makeExploreSessionId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `explore-${Math.random().toString(36).slice(2, 12)}-${Date.now().toString(36)}`;
}

function parseExploreAnalyticsSessionPayload(
  raw: string | null | undefined
): ExploreAnalyticsSessionPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ExploreAnalyticsSessionPayload> | null;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.id !== "string" ||
      !parsed.id ||
      typeof parsed.lastActivityAt !== "number" ||
      !Number.isFinite(parsed.lastActivityAt)
    ) {
      return null;
    }
    return parsed as ExploreAnalyticsSessionPayload;
  } catch {
    return null;
  }
}

export function getOrCreateExploreAnalyticsSessionId(options: { nowMs?: number } = {}): string | null {
  const storage = getStorage();
  if (!storage) return null;
  const nowMs = Number.isFinite(options.nowMs) ? (options.nowMs as number) : Date.now();
  const existing = parseExploreAnalyticsSessionPayload(storage.getItem(EXPLORE_ANALYTICS_SESSION_STORAGE_KEY));
  if (existing && nowMs - existing.lastActivityAt <= EXPLORE_ANALYTICS_SESSION_IDLE_TIMEOUT_MS) {
    const next = {
      ...existing,
      lastActivityAt: nowMs,
    };
    storage.setItem(EXPLORE_ANALYTICS_SESSION_STORAGE_KEY, JSON.stringify(next));
    return existing.id;
  }
  const created: ExploreAnalyticsSessionPayload = {
    id: makeExploreSessionId(),
    lastActivityAt: nowMs,
  };
  storage.setItem(EXPLORE_ANALYTICS_SESSION_STORAGE_KEY, JSON.stringify(created));
  return created.id;
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
  storage.removeItem(EXPLORE_ANALYTICS_SESSION_STORAGE_KEY);
  return [];
}

export function recordExploreAnalyticsEvent(
  input: Omit<ExploreAnalyticsEvent, "at"> & {
    at?: string;
    nowMs?: number;
  }
): ExploreAnalyticsEvent[] {
  const storage = getStorage();
  if (!storage) return [];
  const existing = parseExploreAnalyticsPayload(storage.getItem(EXPLORE_ANALYTICS_STORAGE_KEY));
  const sessionId = getOrCreateExploreAnalyticsSessionId({ nowMs: input.nowMs });
  const marketCode = input.marketCode ?? input.marketCountry ?? null;
  const nextEvent: ExploreAnalyticsEvent = {
    name: input.name,
    at: input.at ?? new Date().toISOString(),
    sessionId,
    listingId: input.listingId ?? null,
    marketCode,
    marketCountry: marketCode,
    intentType: input.intentType ?? null,
    index: input.index,
    feedSize: input.feedSize,
    depth: input.depth,
    fromIndex: input.fromIndex,
    toIndex: input.toIndex,
    action: input.action ?? null,
    result: input.result ?? null,
  };
  return writeExploreAnalyticsEvents(storage, [...existing.events, nextEvent]);
}
