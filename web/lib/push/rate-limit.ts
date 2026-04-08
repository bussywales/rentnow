import { enforceSharedRateLimit } from "@/lib/security/shared-rate-limit";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";

export type PushRateLimitRouteKey = "subscribe" | "unsubscribe";

export type PushRateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
  limit: number;
  resetAt: number;
};

const WINDOW_SECONDS = 10 * 60;
const MAX_REQUESTS = 10;

export async function checkPushRateLimit(input: {
  routeKey: PushRateLimitRouteKey;
  userId: string;
  client?: UntypedAdminClient | null;
  now?: number;
}): Promise<PushRateLimitDecision> {
  const client =
    input.client ?? (hasServiceRoleEnv() ? (createServiceRoleClient() as unknown as UntypedAdminClient) : null);
  return enforceSharedRateLimit({
    client,
    routeKey: `push_${input.routeKey}`,
    scopeKey: `user:${input.userId}`,
    isAuthenticated: true,
    windowSeconds: WINDOW_SECONDS,
    maxRequests: MAX_REQUESTS,
    now: input.now,
  });
}

export function resetPushRateLimitForTests() {
  // no-op retained for test compatibility; shared limiter reset lives in lib/security/shared-rate-limit
}
