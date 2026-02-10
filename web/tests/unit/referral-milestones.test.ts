import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  claimReferralMilestoneBonus,
  resolveReferralMilestoneStatuses,
} from "@/lib/referrals/milestones.server";

type Row = Record<string, unknown>;

function makeMilestoneClient(input: {
  milestones: Row[];
  claims?: Row[];
  listingCredits?: Row[];
  ledgerRows?: Row[];
}) {
  const milestones = [...input.milestones];
  const claims = [...(input.claims ?? [])];
  const listingCredits = [...(input.listingCredits ?? [])];
  const ledgerRows = [...(input.ledgerRows ?? [])];
  let walletSyncCount = 0;

  const client = {
    from: (table: string) => {
      if (table === "referral_milestones") {
        return {
          select: () => ({
            eq: (_column: string, value: unknown) => ({
              maybeSingle: async () => ({
                data: milestones.find((row) => row.id === value) ?? null,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "referral_milestone_claims") {
        return {
          select: () => ({
            eq: (_columnA: string, valueA: unknown) => ({
              eq: (_columnB: string, valueB: unknown) => ({
                maybeSingle: async () => ({
                  data:
                    claims.find(
                      (row) =>
                        row.milestone_id === valueA &&
                        row.user_id === valueB
                    ) ?? null,
                  error: null,
                }),
              }),
            }),
          }),
          insert: async (payload: Row) => {
            const exists = claims.some(
              (row) =>
                row.milestone_id === payload.milestone_id &&
                row.user_id === payload.user_id
            );
            if (exists) {
              return {
                data: null,
                error: { code: "23505", message: "duplicate claim" },
              };
            }
            claims.push(payload);
            return { data: payload, error: null };
          },
        };
      }

      if (table === "listing_credits") {
        return {
          insert: async (payload: Row) => {
            const exists = listingCredits.some(
              (row) =>
                row.user_id === payload.user_id && row.source === payload.source
            );
            if (exists) {
              return {
                data: null,
                error: { code: "23505", message: "duplicate listing credit source" },
              };
            }
            listingCredits.push(payload);
            return { data: payload, error: null };
          },
        };
      }

      if (table === "referral_credit_ledger") {
        return {
          insert: async (payload: Row) => {
            const exists = ledgerRows.some(
              (row) =>
                row.user_id === payload.user_id &&
                row.source_event === payload.source_event &&
                row.source_ref === payload.source_ref
            );
            if (exists) {
              return {
                data: null,
                error: { code: "23505", message: "duplicate milestone ledger row" },
              };
            }
            ledgerRows.push(payload);
            return { data: payload, error: null };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
    rpc: async (name: string) => {
      if (name === "referral_sync_wallet_balance") walletSyncCount += 1;
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;

  return {
    client,
    claims,
    listingCredits,
    ledgerRows,
    getWalletSyncCount: () => walletSyncCount,
  };
}

void test("resolveReferralMilestoneStatuses marks locked, achieved, and claimed states", () => {
  const statuses = resolveReferralMilestoneStatuses({
    milestones: [
      {
        id: "m-locked",
        is_enabled: true,
        name: "Starter",
        active_referrals_threshold: 7,
        bonus_credits: 2,
        created_at: "2026-02-10T10:00:00.000Z",
      },
      {
        id: "m-achieved",
        is_enabled: true,
        name: "Momentum",
        active_referrals_threshold: 3,
        bonus_credits: 5,
        created_at: "2026-02-10T10:01:00.000Z",
      },
      {
        id: "m-claimed",
        is_enabled: true,
        name: "Power",
        active_referrals_threshold: 10,
        bonus_credits: 10,
        created_at: "2026-02-10T10:02:00.000Z",
      },
    ],
    claims: [
      {
        milestone_id: "m-claimed",
        user_id: "user-1",
        claimed_at: "2026-02-10T11:00:00.000Z",
      },
    ],
    activeReferralsCount: 6,
  });

  assert.equal(statuses[0]?.status, "achieved");
  assert.equal(statuses[0]?.claimable, true);
  assert.equal(statuses[1]?.status, "locked");
  assert.equal(statuses[1]?.claimable, false);
  assert.equal(statuses[2]?.status, "claimed");
  assert.equal(statuses[2]?.claimable, false);
});

void test("claimReferralMilestoneBonus is idempotent for duplicate claim attempts", async () => {
  const state = makeMilestoneClient({
    milestones: [
      {
        id: "milestone-1",
        is_enabled: true,
        name: "Starter Boost",
        active_referrals_threshold: 3,
        bonus_credits: 2,
        created_at: "2026-02-10T09:00:00.000Z",
      },
    ],
  });

  const first = await claimReferralMilestoneBonus({
    client: state.client,
    userId: "agent-1",
    milestoneId: "milestone-1",
    activeReferralsCount: 3,
  });

  const second = await claimReferralMilestoneBonus({
    client: state.client,
    userId: "agent-1",
    milestoneId: "milestone-1",
    activeReferralsCount: 3,
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (first.ok) assert.equal(first.alreadyClaimed, false);
  if (second.ok) assert.equal(second.alreadyClaimed, true);

  assert.equal(state.claims.length, 1);
  assert.equal(state.listingCredits.length, 1);
  assert.equal(state.ledgerRows.length, 1);
  assert.equal(state.getWalletSyncCount(), 2);
});

void test("claimReferralMilestoneBonus blocks claim when threshold is unmet", async () => {
  const state = makeMilestoneClient({
    milestones: [
      {
        id: "milestone-2",
        is_enabled: true,
        name: "Momentum Boost",
        active_referrals_threshold: 10,
        bonus_credits: 5,
        created_at: "2026-02-10T09:00:00.000Z",
      },
    ],
  });

  const result = await claimReferralMilestoneBonus({
    client: state.client,
    userId: "agent-2",
    milestoneId: "milestone-2",
    activeReferralsCount: 4,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "THRESHOLD_NOT_MET");
  }
  assert.equal(state.claims.length, 0);
  assert.equal(state.listingCredits.length, 0);
  assert.equal(state.ledgerRows.length, 0);
  assert.equal(state.getWalletSyncCount(), 0);
});
