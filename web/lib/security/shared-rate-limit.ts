import type { UntypedAdminClient } from "@/lib/supabase/untyped";

type SharedRateLimitRow = { created_at?: string | null };

type SharedMemoryRateLimitState = {
  count: number;
  resetAtMs: number;
};

export type SharedRateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
  limit: number;
  resetAt: number;
  source: "db" | "memory";
};

type SharedRateLimitInput = {
  client?: UntypedAdminClient | null;
  routeKey: string;
  scopeKey: string;
  isAuthenticated?: boolean;
  windowSeconds: number;
  maxRequests: number;
  now?: Date | number;
};

const REQUEST_RATE_LIMIT_TABLE = "request_rate_limit_events";

const globalStore = globalThis as typeof globalThis & {
  __sharedRequestRateLimitStore?: Map<string, SharedMemoryRateLimitState>;
};

function getMemoryStore() {
  if (!globalStore.__sharedRequestRateLimitStore) {
    globalStore.__sharedRequestRateLimitStore = new Map();
  }
  return globalStore.__sharedRequestRateLimitStore;
}

function resolveNowMs(now?: Date | number) {
  if (now instanceof Date) return now.getTime();
  if (typeof now === "number" && Number.isFinite(now)) return now;
  return Date.now();
}

function buildDecision(input: Omit<SharedRateLimitDecision, "retryAfterSeconds" | "remaining"> & {
  retryAfterSeconds: number;
  remaining: number;
}): SharedRateLimitDecision {
  return {
    allowed: input.allowed,
    retryAfterSeconds: Math.max(0, Math.ceil(input.retryAfterSeconds)),
    remaining: Math.max(0, input.remaining),
    limit: input.limit,
    resetAt: input.resetAt,
    source: input.source,
  };
}

function enforceViaMemory(input: SharedRateLimitInput): SharedRateLimitDecision {
  const nowMs = resolveNowMs(input.now);
  const windowMs = input.windowSeconds * 1000;
  const key = `${input.routeKey}:${input.scopeKey}`;
  const store = getMemoryStore();
  const existing = store.get(key);

  if (!existing || nowMs >= existing.resetAtMs) {
    const resetAtMs = nowMs + windowMs;
    store.set(key, { count: 1, resetAtMs });
    return buildDecision({
      allowed: true,
      retryAfterSeconds: 0,
      remaining: input.maxRequests - 1,
      limit: input.maxRequests,
      resetAt: resetAtMs,
      source: "memory",
    });
  }

  if (existing.count >= input.maxRequests) {
    return buildDecision({
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000)),
      remaining: 0,
      limit: input.maxRequests,
      resetAt: existing.resetAtMs,
      source: "memory",
    });
  }

  existing.count += 1;
  store.set(key, existing);
  return buildDecision({
    allowed: true,
    retryAfterSeconds: 0,
    remaining: input.maxRequests - existing.count,
    limit: input.maxRequests,
    resetAt: existing.resetAtMs,
    source: "memory",
  });
}

async function enforceViaDb(input: SharedRateLimitInput): Promise<SharedRateLimitDecision> {
  if (!input.client) {
    throw new Error("missing_rate_limit_client");
  }

  const nowMs = resolveNowMs(input.now);
  const windowStartIso = new Date(nowMs - input.windowSeconds * 1000).toISOString();

  const recentResult = await input.client
    .from<SharedRateLimitRow>(REQUEST_RATE_LIMIT_TABLE)
    .select("created_at")
    .eq("route_key", input.routeKey)
    .eq("scope_key", input.scopeKey)
    .gte("created_at", windowStartIso)
    .order("created_at", { ascending: false })
    .range(0, Math.max(0, input.maxRequests - 1));

  if (recentResult.error) {
    throw new Error(recentResult.error.message || "db_rate_limit_read_failed");
  }

  const recentRows = (recentResult.data ?? []) as SharedRateLimitRow[];
  if (recentRows.length >= input.maxRequests) {
    const oldestMs = recentRows[recentRows.length - 1]?.created_at
      ? Date.parse(recentRows[recentRows.length - 1]!.created_at as string)
      : nowMs;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestMs + input.windowSeconds * 1000 - nowMs) / 1000)
    );
    return buildDecision({
      allowed: false,
      retryAfterSeconds,
      remaining: 0,
      limit: input.maxRequests,
      resetAt: oldestMs + input.windowSeconds * 1000,
      source: "db",
    });
  }

  const insertResult = await input.client.from(REQUEST_RATE_LIMIT_TABLE).insert({
    route_key: input.routeKey,
    scope_key: input.scopeKey,
    is_authenticated: !!input.isAuthenticated,
  });

  if (insertResult.error) {
    throw new Error(insertResult.error.message || "db_rate_limit_insert_failed");
  }

  return buildDecision({
    allowed: true,
    retryAfterSeconds: 0,
    remaining: input.maxRequests - (recentRows.length + 1),
    limit: input.maxRequests,
    resetAt: nowMs + input.windowSeconds * 1000,
    source: "db",
  });
}

export async function enforceSharedRateLimit(
  input: SharedRateLimitInput
): Promise<SharedRateLimitDecision> {
  if (input.client) {
    try {
      return await enforceViaDb(input);
    } catch {
      return enforceViaMemory(input);
    }
  }

  return enforceViaMemory(input);
}

export function resetSharedRateLimitForTests() {
  getMemoryStore().clear();
}
