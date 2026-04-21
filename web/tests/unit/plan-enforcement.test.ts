import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActiveListingLimitRecoveryPayload,
  enforceActiveListingLimit,
  getPlanUsage,
} from "@/lib/plan-enforcement";

const buildSupabaseStub = ({
  activeCount,
  planTier,
  maxListingsOverride,
  validUntil = null,
}: {
  activeCount: number;
  planTier: string;
  maxListingsOverride?: number | null;
  validUntil?: string | null;
}) =>
  ({
    from: (table: string) => ({
      select: (...args: unknown[]) => {
        const selectOptions = args[1] as { count?: string; head?: boolean } | undefined;
        if (table === "properties" && selectOptions?.count === "exact" && selectOptions?.head) {
          return {
            eq(column: string) {
              if (column === "is_active") {
                return Promise.resolve({ count: activeCount, error: null });
              }
              return this;
            },
            neq() {
              return Promise.resolve({ count: activeCount, error: null });
            },
          };
        }

        return {
          eq: () => ({
            maybeSingle: async () => ({
              data:
                table === "profile_plans"
                  ? {
                      plan_tier: planTier,
                      max_listings_override: maxListingsOverride ?? null,
                      valid_until: validUntil,
                    }
                  : null,
              error: null,
            }),
          }),
        };
      },
    }),
  }) as never;

void test("plan enforcement respects max listings overrides", async () => {
  const supabase = buildSupabaseStub({
    activeCount: 4,
    planTier: "starter",
    maxListingsOverride: 5,
  });

  const usage = await getPlanUsage({
    supabase,
    ownerId: "owner-1",
    serviceClient: supabase,
  });

  assert.equal(usage.plan.tier, "starter");
  assert.equal(usage.plan.maxListings, 5);
  assert.equal(usage.activeCount, 4);
});

void test("active listing limit blocks when override ceiling is reached", async () => {
  const supabase = buildSupabaseStub({
    activeCount: 5,
    planTier: "starter",
    maxListingsOverride: 5,
  });

  const result = await enforceActiveListingLimit({
    supabase,
    ownerId: "owner-1",
    serviceClient: supabase,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "plan_limit_reached");
  assert.equal(result.planTier, "starter");
  assert.equal(result.maxListings, 5);
  assert.equal(result.activeCount, 5);
});

void test("active listing limit recovery payload includes billing and resume routes", async () => {
  const supabase = buildSupabaseStub({
    activeCount: 5,
    planTier: "starter",
    maxListingsOverride: 5,
  });

  const result = await enforceActiveListingLimit({
    supabase,
    ownerId: "owner-1",
    serviceClient: supabase,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;

  const recovery = buildActiveListingLimitRecoveryPayload({
    gate: result,
    requesterRole: "landlord",
    context: "submission",
    propertyId: "prop-1",
  });

  assert.equal(recovery.reason, "LISTING_LIMIT_REACHED");
  assert.equal(recovery.billingUrl, "/dashboard/billing#plans");
  assert.equal(recovery.manageUrl, "/dashboard");
  assert.match(recovery.resumeUrl ?? "", /monetization=listing_limit/);
  assert.match(recovery.resumeUrl ?? "", /active_count=5/);
  assert.match(recovery.detail, /5 active listings out of 5/);
});
