import test from "node:test";
import assert from "node:assert/strict";
import { resolveReferralTierStatus } from "@/lib/referrals/settings";
import { normalizeDisplayName, rankLeaderboardRows } from "@/lib/referrals/leaderboard.server";

void test("tier status remains consistent with active referral thresholds", () => {
  const thresholds = {
    Bronze: 0,
    Silver: 5,
    Gold: 15,
    Platinum: 30,
  };

  assert.equal(resolveReferralTierStatus(0, thresholds).currentTier, "Bronze");
  assert.equal(resolveReferralTierStatus(8, thresholds).currentTier, "Silver");
  assert.equal(resolveReferralTierStatus(15, thresholds).currentTier, "Gold");
  assert.equal(resolveReferralTierStatus(31, thresholds).currentTier, "Platinum");
});

void test("leaderboard ranking sorts by active referrals and allows ties", () => {
  const ranked = rankLeaderboardRows([
    {
      userId: "agent-a",
      displayName: "A. Adewale",
      tier: "Gold",
      activeReferrals: 9,
      optedOut: false,
      joinedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      userId: "agent-b",
      displayName: "B. Balogun",
      tier: "Gold",
      activeReferrals: 9,
      optedOut: false,
      joinedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      userId: "agent-c",
      displayName: "C. Chukwu",
      tier: "Silver",
      activeReferrals: 5,
      optedOut: false,
      joinedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      userId: "agent-d",
      displayName: "D. Danjuma",
      tier: "Bronze",
      activeReferrals: 0,
      optedOut: true,
      joinedAt: "2026-01-01T00:00:00.000Z",
    },
  ]);

  assert.equal(ranked.length, 4);
  assert.equal(ranked[0]?.rank, 1);
  assert.equal(ranked[1]?.rank, 1);
  assert.equal(ranked[2]?.rank, 3);
  assert.equal(ranked[3]?.rank, 4);
  assert.equal(ranked[0]?.activeReferrals, 9);
  assert.equal(ranked[1]?.activeReferrals, 9);
});

void test("leaderboard display names support initials and full-name modes", () => {
  assert.equal(
    normalizeDisplayName({
      name: "Dayo Adewale",
      userId: "123456",
      initialsOnly: true,
    }),
    "D. Adewale"
  );
  assert.equal(
    normalizeDisplayName({
      name: "Dayo Adewale",
      userId: "123456",
      initialsOnly: false,
    }),
    "Dayo Adewale"
  );
  assert.match(
    normalizeDisplayName({
      name: "",
      userId: "123456",
      initialsOnly: true,
    }),
    /^Agent 123456/
  );
});
