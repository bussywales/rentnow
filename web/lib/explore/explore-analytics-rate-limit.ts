import { enforceSharedRateLimit } from "@/lib/security/shared-rate-limit";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export type ExploreAnalyticsRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
  limit: number;
  resetAt: number;
  source?: "db" | "memory";
};

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 60;

export async function checkExploreAnalyticsRateLimit(input: {
  scopeKey: string;
  isAuthenticated?: boolean;
  client?: UntypedAdminClient | null;
  now?: number;
}): Promise<ExploreAnalyticsRateLimitResult> {
  const client =
    input.client ?? (hasServiceRoleEnv() ? (createServiceRoleClient() as unknown as UntypedAdminClient) : null);
  return enforceSharedRateLimit({
    client,
    routeKey: "explore_analytics_ingest",
    scopeKey: input.scopeKey,
    isAuthenticated: input.isAuthenticated ?? false,
    windowSeconds: WINDOW_SECONDS,
    maxRequests: MAX_REQUESTS,
    now: input.now,
  });
}

export function resetExploreAnalyticsRateLimitForTests() {
  // no-op retained for test compatibility; shared limiter reset lives in lib/security/shared-rate-limit
}
