export type PushRateLimitRouteKey = "subscribe" | "unsubscribe";

export type PushRateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
  limit: number;
  resetAt: number;
};

type PushRateLimitState = {
  count: number;
  resetAt: number;
};

const WINDOW_SECONDS = 10 * 60;
const MAX_REQUESTS = 10;

type PushRateLimitStore = Map<string, PushRateLimitState>;

const globalStore = globalThis as typeof globalThis & {
  __pushRateLimitStore?: PushRateLimitStore;
};

function getStore() {
  if (!globalStore.__pushRateLimitStore) {
    globalStore.__pushRateLimitStore = new Map();
  }
  return globalStore.__pushRateLimitStore;
}

export function checkPushRateLimit(input: {
  routeKey: PushRateLimitRouteKey;
  userId: string;
  now?: number;
}): PushRateLimitDecision {
  const now = input.now ?? Date.now();
  const windowMs = WINDOW_SECONDS * 1000;
  const key = `${input.routeKey}:${input.userId}`;
  const store = getStore();
  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: MAX_REQUESTS - 1,
      limit: MAX_REQUESTS,
      resetAt: now + windowMs,
    };
  }

  if (existing.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      remaining: 0,
      limit: MAX_REQUESTS,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  store.set(key, existing);

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, MAX_REQUESTS - existing.count),
    limit: MAX_REQUESTS,
    resetAt: existing.resetAt,
  };
}

export function resetPushRateLimitForTests() {
  getStore().clear();
}
