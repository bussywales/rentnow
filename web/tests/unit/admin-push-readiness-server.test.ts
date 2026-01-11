import test from "node:test";
import assert from "node:assert/strict";

import { getAdminPushSubscriptionStatus } from "../../lib/admin/push-readiness";

function buildSupabase(result: { count: number | null; error: { message: string } | null }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => result,
        }),
      }),
    }),
  };
}

void test("admin subscription status returns active count", async () => {
  const supabase = buildSupabase({ count: 2, error: null });
  const status = await getAdminPushSubscriptionStatus({
    supabase,
    userId: "admin-id",
  });

  assert.equal(status.available, true);
  assert.equal(status.activeCount, 2);
  assert.equal(status.hasActiveSubscription, true);
});

void test("admin subscription status handles query errors", async () => {
  const supabase = buildSupabase({
    count: null,
    error: { message: "boom" },
  });
  const status = await getAdminPushSubscriptionStatus({
    supabase,
    userId: "admin-id",
  });

  assert.equal(status.available, false);
  assert.equal(status.hasActiveSubscription, false);
  assert.equal(status.error, "boom");
});
