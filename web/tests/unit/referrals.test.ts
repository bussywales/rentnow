import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  captureReferralForUser,
  ensureReferralCode,
  generateReferralCodeCandidate,
  getReferralAncestors,
  issueReferralRewardsForEvent,
} from "@/lib/referrals/referrals.server";

function makeSelectChain(rows: Array<Record<string, unknown>>) {
  const filters: Array<(row: Record<string, unknown>) => boolean> = [];

  const applyFilters = () => rows.filter((row) => filters.every((predicate) => predicate(row)));

  const chain = {
    eq(column: string, value: unknown) {
      filters.push((row) => row[column] === value);
      return chain;
    },
    gte(column: string, value: unknown) {
      filters.push((row) => String(row[column] ?? "") >= String(value ?? ""));
      return chain;
    },
    in(column: string, values: unknown[]) {
      filters.push((row) => values.includes(row[column]));
      return chain;
    },
    async maybeSingle() {
      const filtered = applyFilters();
      return { data: filtered[0] ?? null, error: null };
    },
    then(
      onFulfilled: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) {
      return Promise.resolve({ data: applyFilters(), error: null }).then(onFulfilled, onRejected);
    },
  };

  return chain;
}

void test("generateReferralCodeCandidate returns uppercase code", () => {
  const code = generateReferralCodeCandidate(8, () => 0.04);
  assert.equal(code, "BBBBBBBB");
});

void test("ensureReferralCode retries on collision and stores unique code", async () => {
  const referralCodes: Array<Record<string, unknown>> = [
    { user_id: "existing-user", code: "AAAAAAAA" },
  ];

  const client = {
    from: (table: string) => {
      assert.equal(table, "referral_codes");
      return {
        select: () => ({
          eq: (_column: string, value: unknown) => ({
            maybeSingle: async () => ({
              data: referralCodes.find((row) => row.user_id === value) ?? null,
              error: null,
            }),
          }),
        }),
        insert: (payload: Record<string, unknown>) => {
          const runInsert = () => {
            if (referralCodes.some((row) => row.code === payload.code)) {
              return {
                data: null,
                error: { code: "23505", message: "referral_codes_code_key" },
              };
            }
            referralCodes.push(payload);
            return { data: payload, error: null };
          };

          return {
            select: () => ({
              maybeSingle: async () => runInsert(),
            }),
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  const randomValues = [...Array(8).fill(0), ...Array(8).fill(0.04)] as number[];
  let idx = 0;
  const originalRandom = Math.random;
  Math.random = () => {
    const value = randomValues[idx] ?? 0.04;
    idx += 1;
    return value;
  };

  try {
    const result = await ensureReferralCode({ client, userId: "new-user" });
    assert.equal(result.code, "BBBBBBBB");
    assert.equal(result.created, true);
  } finally {
    Math.random = originalRandom;
  }
});

void test("depth chain resolves up to level 5 and capture enforces depth limit", async () => {
  const referrals: Array<Record<string, unknown>> = [
    { referred_user_id: "u2", referrer_user_id: "u1", depth: 1, created_at: "2026-02-09T00:00:00.000Z" },
    { referred_user_id: "u3", referrer_user_id: "u2", depth: 2, created_at: "2026-02-09T00:00:00.000Z" },
    { referred_user_id: "u4", referrer_user_id: "u3", depth: 3, created_at: "2026-02-09T00:00:00.000Z" },
    { referred_user_id: "u5", referrer_user_id: "u4", depth: 4, created_at: "2026-02-09T00:00:00.000Z" },
    { referred_user_id: "u6", referrer_user_id: "u5", depth: 5, created_at: "2026-02-09T00:00:00.000Z" },
  ];

  const referralCodes: Array<Record<string, unknown>> = [
    { user_id: "u6", code: "U6CODE" },
  ];

  const client = {
    from: (table: string) => {
      if (table === "referrals") {
        return {
          select: () => ({
            eq: (_column: string, value: unknown) => ({
              maybeSingle: async () => ({
                data: referrals.find((row) => row.referred_user_id === value) ?? null,
                error: null,
              }),
            }),
          }),
          insert: (payload: Record<string, unknown>) => {
            if (referrals.some((row) => row.referred_user_id === payload.referred_user_id)) {
              return Promise.resolve({
                data: null,
                error: { code: "23505", message: "referrals_referred_user_id_key" },
              });
            }
            referrals.push(payload);
            return Promise.resolve({ data: payload, error: null });
          },
        };
      }
      if (table === "referral_codes") {
        return {
          select: () => ({
            eq: (_column: string, value: unknown) => ({
              maybeSingle: async () => ({
                data: referralCodes.find((row) => row.code === value) ?? null,
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;

  const chain = await getReferralAncestors({ client, userId: "u6", maxDepth: 5 });
  assert.deepEqual(
    chain,
    [
      { userId: "u5", level: 1 },
      { userId: "u4", level: 2 },
      { userId: "u3", level: 3 },
      { userId: "u2", level: 4 },
      { userId: "u1", level: 5 },
    ]
  );

  const result = await captureReferralForUser({
    client,
    referredUserId: "u7",
    referralCode: "U6CODE",
    maxDepth: 5,
  });

  assert.equal(result.ok, true);
  assert.equal(result.captured, false);
  assert.equal(result.reason, "depth_limit");
});

void test("issueReferralRewardsForEvent is idempotent for same event reference", async () => {
  const appSettings: Array<Record<string, unknown>> = [
    { key: "referrals_enabled", value: { enabled: true } },
    { key: "referral_max_depth", value: { value: 5 } },
    { key: "referral_enabled_levels", value: { value: [1] } },
    {
      key: "referral_reward_rules",
      value: { value: { "1": { type: "listing_credit", amount: 1 } } },
    },
    {
      key: "referral_tier_thresholds",
      value: { value: { bronze: 0, silver: 5 } },
    },
    { key: "referral_caps", value: { value: { daily: 50, monthly: 500 } } },
  ];

  const profiles = [{ id: "agent-new", role: "agent" }];
  const referrals = [
    {
      referred_user_id: "agent-new",
      referrer_user_id: "agent-ref",
      depth: 1,
      created_at: "2026-02-09T00:00:00.000Z",
    },
  ];
  const referralRewards: Array<Record<string, unknown>> = [];
  const listingCredits: Array<Record<string, unknown>> = [];

  const client = {
    from: (table: string) => {
      if (table === "app_settings") {
        return {
          select: () => makeSelectChain(appSettings),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: (_column: string, value: unknown) => ({
              maybeSingle: async () => ({
                data: profiles.find((row) => row.id === value) ?? null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "referrals") {
        return {
          select: () => ({
            eq: (_column: string, value: unknown) => ({
              maybeSingle: async () => ({
                data: referrals.find((row) => row.referred_user_id === value) ?? null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "referral_rewards") {
        return {
          select: () => makeSelectChain(referralRewards),
          insert: (payload: Record<string, unknown>) => {
            const exists = referralRewards.some(
              (row) =>
                row.referrer_user_id === payload.referrer_user_id &&
                row.referred_user_id === payload.referred_user_id &&
                row.level === payload.level &&
                row.event_type === payload.event_type &&
                row.event_reference === payload.event_reference
            );
            if (exists) {
              return Promise.resolve({
                data: null,
                error: { code: "23505", message: "referral_rewards_unique" },
              });
            }
            referralRewards.push(payload);
            return Promise.resolve({ data: payload, error: null });
          },
        };
      }
      if (table === "listing_credits") {
        return {
          select: () => makeSelectChain(listingCredits),
          insert: (payload: Record<string, unknown>) => {
            listingCredits.push(payload);
            return Promise.resolve({ data: payload, error: null });
          },
        };
      }
      if (table === "featured_credits") {
        return {
          select: () => makeSelectChain([]),
          insert: () => Promise.resolve({ data: null, error: null }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;

  const first = await issueReferralRewardsForEvent({
    client,
    referredUserId: "agent-new",
    eventType: "subscription_paid",
    eventReference: "paystack:sub-123",
    issuedAt: "2026-02-09T10:00:00.000Z",
  });

  const second = await issueReferralRewardsForEvent({
    client,
    referredUserId: "agent-new",
    eventType: "subscription_paid",
    eventReference: "paystack:sub-123",
    issuedAt: "2026-02-09T10:00:00.000Z",
  });

  assert.equal(first.issued, 1);
  assert.equal(second.issued, 0);
  assert.equal(referralRewards.length, 1);
  assert.equal(listingCredits.length, 1);
  assert.equal(listingCredits[0].credits_total, 1);
});
