export type ExploreAnalyticsRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
  limit: number;
  resetAt: number;
};

type ExploreAnalyticsRateLimitState = {
  count: number;
  resetAt: number;
};

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 60;

type ExploreAnalyticsRateLimitStore = Map<string, ExploreAnalyticsRateLimitState>;

const globalStore = globalThis as typeof globalThis & {
  __exploreAnalyticsRateLimitStore?: ExploreAnalyticsRateLimitStore;
};

function getStore() {
  if (!globalStore.__exploreAnalyticsRateLimitStore) {
    globalStore.__exploreAnalyticsRateLimitStore = new Map();
  }
  return globalStore.__exploreAnalyticsRateLimitStore;
}

export function checkExploreAnalyticsRateLimit(input: {
  userId: string;
  now?: number;
}): ExploreAnalyticsRateLimitResult {
  const now = input.now ?? Date.now();
  const windowMs = WINDOW_SECONDS * 1000;
  const key = input.userId;
  const store = getStore();
  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: MAX_REQUESTS - 1,
      limit: MAX_REQUESTS,
      resetAt,
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

export function resetExploreAnalyticsRateLimitForTests() {
  getStore().clear();
}
