import test from "node:test";
import assert from "node:assert/strict";
import { enforceActiveListingLimit, getPlanUsage } from "@/lib/plan-enforcement";

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
