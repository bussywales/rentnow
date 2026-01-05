import type { MessagingPermissionCode } from "@/lib/messaging/permissions";

type RateLimiterOptions = {
  windowSeconds: number;
  maxSends: number;
  nowFn?: () => number;
};

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
  limit: number;
  resetAt: number;
};

export type RateLimitEvent = {
  senderId: string;
  recipientId: string | null;
  propertyId: string | null;
  createdAt: string;
  reasonCode: MessagingPermissionCode;
  retryAfterSeconds: number;
};

export type RateLimitSnapshot = {
  windowSeconds: number;
  total: number;
  bySender: Array<{ senderId: string; count: number }>;
  events: RateLimitEvent[];
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

const DEFAULT_WINDOW_SECONDS = 60;
const DEFAULT_MAX_SENDS = 6;
const MAX_EVENTS = 200;

type RateLimitStore = {
  limiter?: InMemoryRateLimiter;
  events: RateLimitEvent[];
  config?: { windowSeconds: number; maxSends: number };
};

const globalStore = globalThis as typeof globalThis & {
  __messagingRateLimit?: RateLimitStore;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function getConfig() {
  const windowSeconds = parsePositiveInt(
    process.env.MESSAGING_RATE_LIMIT_WINDOW_SECONDS,
    DEFAULT_WINDOW_SECONDS
  );
  const maxSends = parsePositiveInt(
    process.env.MESSAGING_RATE_LIMIT_MAX_SENDS,
    DEFAULT_MAX_SENDS
  );
  return { windowSeconds, maxSends };
}

export function getMessagingRateLimitConfig() {
  return getConfig();
}

class InMemoryRateLimiter {
  private map = new Map<string, RateLimitState>();
  private windowMs: number;
  private maxSends: number;
  private nowFn: () => number;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowSeconds * 1000;
    this.maxSends = options.maxSends;
    this.nowFn = options.nowFn ?? Date.now;
  }

  check(key: string): RateLimitDecision {
    const now = this.nowFn();
    const existing = this.map.get(key);
    let state = existing;

    if (!state || now >= state.resetAt) {
      state = { count: 0, resetAt: now + this.windowMs };
    }

    if (state.count >= this.maxSends) {
      this.map.set(key, state);
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((state.resetAt - now) / 1000)
      );
      return {
        allowed: false,
        retryAfterSeconds,
        remaining: 0,
        limit: this.maxSends,
        resetAt: state.resetAt,
      };
    }

    state.count += 1;
    this.map.set(key, state);

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(0, this.maxSends - state.count),
      limit: this.maxSends,
      resetAt: state.resetAt,
    };
  }
}

export function createRateLimiter(options: RateLimiterOptions) {
  return new InMemoryRateLimiter(options);
}

function getStore(): RateLimitStore {
  if (!globalStore.__messagingRateLimit) {
    globalStore.__messagingRateLimit = {
      events: [],
    };
  }
  return globalStore.__messagingRateLimit;
}

export function getMessagingRateLimiter() {
  const store = getStore();
  const config = getConfig();

  if (
    !store.limiter ||
    store.config?.windowSeconds !== config.windowSeconds ||
    store.config?.maxSends !== config.maxSends
  ) {
    store.limiter = createRateLimiter({
      windowSeconds: config.windowSeconds,
      maxSends: config.maxSends,
    });
    store.config = config;
  }

  return store.limiter;
}

export function checkMessagingRateLimit(input: {
  senderId: string;
  recipientId?: string | null;
  propertyId?: string | null;
}) {
  const limiter = getMessagingRateLimiter();
  const keyParts = [input.senderId, input.propertyId ?? "unknown"];
  const key = keyParts.join(":");
  const decision = limiter.check(key);

  if (!decision.allowed) {
    recordRateLimitEvent({
      senderId: input.senderId,
      recipientId: input.recipientId ?? null,
      propertyId: input.propertyId ?? null,
      retryAfterSeconds: decision.retryAfterSeconds,
    });
  }

  return decision;
}

export function recordRateLimitEvent(input: {
  senderId: string;
  recipientId: string | null;
  propertyId: string | null;
  retryAfterSeconds: number;
}) {
  const store = getStore();
  store.events.unshift({
    senderId: input.senderId,
    recipientId: input.recipientId,
    propertyId: input.propertyId,
    createdAt: new Date().toISOString(),
    reasonCode: "rate_limited",
    retryAfterSeconds: input.retryAfterSeconds,
  });

  if (store.events.length > MAX_EVENTS) {
    store.events.length = MAX_EVENTS;
  }
}

export function getRateLimitSnapshot(windowSeconds?: number): RateLimitSnapshot {
  const store = getStore();
  const config = getConfig();
  const window = windowSeconds ?? config.windowSeconds;
  const cutoff = Date.now() - window * 1000;
  const events = store.events.filter((event) => Date.parse(event.createdAt) >= cutoff);

  const bySenderMap = new Map<string, number>();
  for (const event of events) {
    bySenderMap.set(event.senderId, (bySenderMap.get(event.senderId) ?? 0) + 1);
  }

  const bySender = Array.from(bySenderMap.entries())
    .map(([senderId, count]) => ({ senderId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    windowSeconds: window,
    total: events.length,
    bySender,
    events,
  };
}
