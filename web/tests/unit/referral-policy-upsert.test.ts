import test from "node:test";
import assert from "node:assert/strict";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { upsertReferralJurisdictionPolicy } from "@/lib/referrals/policies.server";

void test("upsertReferralJurisdictionPolicy uses country_code conflict key and updates existing policy", async () => {
  const rows: Array<Record<string, unknown>> = [];
  let onConflictValue: string | null = null;

  const adminClient = {
    from: (table: string) => {
      assert.equal(table, "referral_jurisdiction_policies");
      return {
        upsert: (payload: Record<string, unknown>, options?: { onConflict?: string }) => {
          onConflictValue = options?.onConflict ?? null;
          return {
            select: () => ({
              maybeSingle: async () => {
                const index = rows.findIndex((row) => row.country_code === payload.country_code);
                if (index >= 0) {
                  rows[index] = {
                    ...rows[index],
                    ...payload,
                  };
                  return { data: rows[index], error: null };
                }
                const row = {
                  id: `policy-${rows.length + 1}`,
                  ...payload,
                };
                rows.push(row);
                return { data: row, error: null };
              },
            }),
          };
        },
      };
    },
  } as unknown as UntypedAdminClient;

  const now = "2026-02-10T12:00:00.000Z";
  const updatedAt = "2026-02-10T12:05:00.000Z";

  await upsertReferralJurisdictionPolicy(
    adminClient,
    {
      country_code: "ng",
      payouts_enabled: false,
      conversion_enabled: false,
      cashout_rate_amount_minor: 5000,
      currency: "ngn",
    },
    now
  );

  const result = await upsertReferralJurisdictionPolicy(
    adminClient,
    {
      country_code: "NG",
      payouts_enabled: true,
      conversion_enabled: true,
      cashout_rate_amount_minor: 7000,
      currency: "NGN",
    },
    updatedAt
  );

  assert.equal(onConflictValue, "country_code");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].country_code, "NG");
  assert.equal(rows[0].payouts_enabled, true);
  assert.equal(rows[0].cashout_rate_amount_minor, 7000);
  assert.equal(result.error, null);
  assert.equal(result.data?.country_code, "NG");
});
