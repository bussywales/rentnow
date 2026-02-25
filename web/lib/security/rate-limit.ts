import { createHash } from "node:crypto";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export type SupportRateLimitRouteKey = "support_contact" | "support_escalate";

export type SupportRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
  limit: number;
  scopeKey: string;
  source: "db" | "memory";
};

type SupportRateLimitPolicy = {
  windowSeconds: number;
  maxRequestsAnonymous: number;
  maxRequestsAuthenticated: number;
};

type RateLimitRow = { created_at?: string | null };

type MemoryRateLimitState = {
  count: number;
  resetAtMs: number;
};

const SUPPORT_RATE_LIMIT_TABLE = "support_rate_limit_events";

const SUPPORT_RATE_LIMIT_POLICIES: Record<SupportRateLimitRouteKey, SupportRateLimitPolicy> = {
  support_escalate: {
    windowSeconds: 60,
    maxRequestsAnonymous: 5,
    maxRequestsAuthenticated: 20,
  },
  support_contact: {
    windowSeconds: 60,
    maxRequestsAnonymous: 10,
    maxRequestsAuthenticated: 20,
  },
};

const globalStore = globalThis as typeof globalThis & {
  __supportRateLimitStore?: Map<string, MemoryRateLimitState>;
};

function getMemoryStore() {
  if (!globalStore.__supportRateLimitStore) {
    globalStore.__supportRateLimitStore = new Map();
  }
  return globalStore.__supportRateLimitStore;
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function resolveRequestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp?.trim()) return cfIp.trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  return "";
}

export function resolveSupportRateLimitScopeKey(input: {
  request: Request;
  userId?: string | null;
}) {
  if (input.userId) return `user:${input.userId}`;

  const ip = resolveRequestIp(input.request);
  if (ip) return `ip:${hashValue(ip)}`;

  const userAgent = input.request.headers.get("user-agent") || "unknown-agent";
  return `anon:${hashValue(userAgent)}`;
}

function buildRateLimitResult(
  input: Omit<SupportRateLimitResult, "allowed"> & { allowed: boolean }
): SupportRateLimitResult {
  return {
    allowed: input.allowed,
    retryAfterSeconds: Math.max(0, Math.ceil(input.retryAfterSeconds)),
    remaining: Math.max(0, input.remaining),
    limit: input.limit,
    scopeKey: input.scopeKey,
    source: input.source,
  };
}

async function enforceSupportRateLimitViaDb(input: {
  client: UntypedAdminClient;
  request: Request;
  routeKey: SupportRateLimitRouteKey;
  userId?: string | null;
  now: Date;
}) {
  const policy = SUPPORT_RATE_LIMIT_POLICIES[input.routeKey];
  const isAuthenticated = !!input.userId;
  const maxRequests = isAuthenticated
    ? policy.maxRequestsAuthenticated
    : policy.maxRequestsAnonymous;
  const scopeKey = resolveSupportRateLimitScopeKey({
    request: input.request,
    userId: input.userId ?? null,
  });
  const nowMs = input.now.getTime();
  const windowStartIso = new Date(nowMs - policy.windowSeconds * 1000).toISOString();

  const recentResult = await input.client
    .from<RateLimitRow>(SUPPORT_RATE_LIMIT_TABLE)
    .select("created_at")
    .eq("route_key", input.routeKey)
    .eq("scope_key", scopeKey)
    .gte("created_at", windowStartIso)
    .order("created_at", { ascending: false })
    .range(0, Math.max(0, maxRequests - 1));

  if (recentResult.error) {
    throw new Error(recentResult.error.message || "db_rate_limit_read_failed");
  }

  const recentRows = (recentResult.data ?? []) as RateLimitRow[];
  if (recentRows.length >= maxRequests) {
    const oldest = recentRows[recentRows.length - 1];
    const oldestMs = oldest?.created_at ? Date.parse(oldest.created_at) : nowMs;
    const retryAfter = Math.max(1, Math.ceil((oldestMs + policy.windowSeconds * 1000 - nowMs) / 1000));
    return buildRateLimitResult({
      allowed: false,
      retryAfterSeconds: retryAfter,
      remaining: 0,
      limit: maxRequests,
      scopeKey,
      source: "db",
    });
  }

  const insertResult = await input.client.from(SUPPORT_RATE_LIMIT_TABLE).insert({
    route_key: input.routeKey,
    scope_key: scopeKey,
    is_authenticated: isAuthenticated,
  });

  if (insertResult.error) {
    throw new Error(insertResult.error.message || "db_rate_limit_insert_failed");
  }

  return buildRateLimitResult({
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, maxRequests - (recentRows.length + 1)),
    limit: maxRequests,
    scopeKey,
    source: "db",
  });
}

function enforceSupportRateLimitViaMemory(input: {
  request: Request;
  routeKey: SupportRateLimitRouteKey;
  userId?: string | null;
  now: Date;
}) {
  const policy = SUPPORT_RATE_LIMIT_POLICIES[input.routeKey];
  const isAuthenticated = !!input.userId;
  const maxRequests = isAuthenticated
    ? policy.maxRequestsAuthenticated
    : policy.maxRequestsAnonymous;
  const scopeKey = resolveSupportRateLimitScopeKey({
    request: input.request,
    userId: input.userId ?? null,
  });
  const key = `${input.routeKey}:${scopeKey}`;
  const store = getMemoryStore();
  const nowMs = input.now.getTime();
  const windowMs = policy.windowSeconds * 1000;
  const existing = store.get(key);

  if (!existing || nowMs >= existing.resetAtMs) {
    store.set(key, { count: 1, resetAtMs: nowMs + windowMs });
    return buildRateLimitResult({
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(0, maxRequests - 1),
      limit: maxRequests,
      scopeKey,
      source: "memory",
    });
  }

  if (existing.count >= maxRequests) {
    return buildRateLimitResult({
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000)),
      remaining: 0,
      limit: maxRequests,
      scopeKey,
      source: "memory",
    });
  }

  existing.count += 1;
  store.set(key, existing);

  return buildRateLimitResult({
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, maxRequests - existing.count),
    limit: maxRequests,
    scopeKey,
    source: "memory",
  });
}

export async function enforceSupportRateLimit(input: {
  client?: UntypedAdminClient | null;
  request: Request;
  routeKey: SupportRateLimitRouteKey;
  userId?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.client) {
    try {
      return await enforceSupportRateLimitViaDb({
        client: input.client,
        request: input.request,
        routeKey: input.routeKey,
        userId: input.userId ?? null,
        now,
      });
    } catch {
      return enforceSupportRateLimitViaMemory({
        request: input.request,
        routeKey: input.routeKey,
        userId: input.userId ?? null,
        now,
      });
    }
  }

  return enforceSupportRateLimitViaMemory({
    request: input.request,
    routeKey: input.routeKey,
    userId: input.userId ?? null,
    now,
  });
}
