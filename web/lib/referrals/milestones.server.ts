import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { parseAppSettingBool } from "@/lib/settings/app-settings";

export type ReferralMilestone = {
  id: string;
  is_enabled: boolean;
  name: string;
  active_referrals_threshold: number;
  bonus_credits: number;
  created_at: string;
};

export type ReferralMilestoneClaim = {
  milestone_id: string;
  user_id: string;
  claimed_at: string;
};

export type ReferralMilestoneStatus = {
  id: string;
  name: string;
  threshold: number;
  bonusCredits: number;
  isEnabled: boolean;
  status: "locked" | "achieved" | "claimed";
  claimable: boolean;
  claimedAt: string | null;
};

type ReferralMilestoneClaimResult =
  | {
      ok: true;
      milestone: ReferralMilestone;
      alreadyClaimed: boolean;
    }
  | {
      ok: false;
      reason:
        | "MILESTONE_NOT_FOUND"
        | "MILESTONE_DISABLED"
        | "THRESHOLD_NOT_MET"
        | "CLAIM_INSERT_FAILED"
        | "BONUS_ISSUE_FAILED"
        | "BONUS_LEDGER_FAILED";
    };

function sortMilestones(milestones: ReferralMilestone[]) {
  return [...milestones].sort((a, b) => {
    if (a.active_referrals_threshold !== b.active_referrals_threshold) {
      return a.active_referrals_threshold - b.active_referrals_threshold;
    }
    return String(a.created_at).localeCompare(String(b.created_at));
  });
}

function normalizeMilestone(row: Partial<ReferralMilestone>): ReferralMilestone | null {
  const id = String(row.id || "").trim();
  const name = String(row.name || "").trim();
  if (!id || !name) return null;

  return {
    id,
    is_enabled: Boolean(row.is_enabled),
    name,
    active_referrals_threshold: Math.max(
      1,
      Math.trunc(Number(row.active_referrals_threshold || 0))
    ),
    bonus_credits: Math.max(1, Math.trunc(Number(row.bonus_credits || 0))),
    created_at: String(row.created_at || new Date(0).toISOString()),
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code || "") : "";
  const message =
    "message" in error ? String((error as { message?: unknown }).message || "") : "";
  return code === "23505" || /duplicate|unique/i.test(message);
}

export async function isReferralMilestonesEnabled(
  client: SupabaseClient,
  defaultValue = true
): Promise<boolean> {
  const { data } = await client
    .from("app_settings")
    .select("value")
    .eq("key", APP_SETTING_KEYS.referralsMilestonesEnabled)
    .maybeSingle<{ value: unknown }>();

  return parseAppSettingBool(data?.value, defaultValue);
}

export async function getReferralMilestones(input: {
  client: SupabaseClient;
  onlyEnabled?: boolean;
}): Promise<ReferralMilestone[]> {
  let query = input.client
    .from("referral_milestones")
    .select("id, is_enabled, name, active_referrals_threshold, bonus_credits, created_at")
    .order("active_referrals_threshold", { ascending: true })
    .order("created_at", { ascending: true });

  if (input.onlyEnabled) {
    query = query.eq("is_enabled", true);
  }

  const { data } = await query;
  const milestones = ((data as Partial<ReferralMilestone>[] | null) ?? [])
    .map(normalizeMilestone)
    .filter((row): row is ReferralMilestone => Boolean(row));

  return sortMilestones(milestones);
}

export async function getReferralMilestoneClaimsForUser(input: {
  client: SupabaseClient;
  userId: string;
}): Promise<ReferralMilestoneClaim[]> {
  const { data } = await input.client
    .from("referral_milestone_claims")
    .select("milestone_id, user_id, claimed_at")
    .eq("user_id", input.userId);

  return ((data as ReferralMilestoneClaim[] | null) ?? []).map((row) => ({
    milestone_id: String(row.milestone_id),
    user_id: String(row.user_id),
    claimed_at: String(row.claimed_at),
  }));
}

export function resolveReferralMilestoneStatuses(input: {
  milestones: ReferralMilestone[];
  claims: ReferralMilestoneClaim[];
  activeReferralsCount: number;
}): ReferralMilestoneStatus[] {
  const activeReferralsCount = Math.max(0, Math.trunc(Number(input.activeReferralsCount || 0)));
  const claimMap = new Map(input.claims.map((claim) => [claim.milestone_id, claim.claimed_at]));

  return sortMilestones(input.milestones).map((milestone) => {
    const claimedAt = claimMap.get(milestone.id) ?? null;
    if (claimedAt) {
      return {
        id: milestone.id,
        name: milestone.name,
        threshold: milestone.active_referrals_threshold,
        bonusCredits: milestone.bonus_credits,
        isEnabled: milestone.is_enabled,
        status: "claimed",
        claimable: false,
        claimedAt,
      };
    }

    const achieved = activeReferralsCount >= milestone.active_referrals_threshold;
    return {
      id: milestone.id,
      name: milestone.name,
      threshold: milestone.active_referrals_threshold,
      bonusCredits: milestone.bonus_credits,
      isEnabled: milestone.is_enabled,
      status: achieved ? "achieved" : "locked",
      claimable: Boolean(milestone.is_enabled && achieved),
      claimedAt: null,
    };
  });
}

export async function getReferralMilestoneStatusesForUser(input: {
  client: SupabaseClient;
  userId: string;
  activeReferralsCount: number;
  includeDisabled?: boolean;
}): Promise<ReferralMilestoneStatus[]> {
  const [milestones, claims] = await Promise.all([
    getReferralMilestones({ client: input.client, onlyEnabled: !input.includeDisabled }),
    getReferralMilestoneClaimsForUser({ client: input.client, userId: input.userId }),
  ]);

  return resolveReferralMilestoneStatuses({
    milestones,
    claims,
    activeReferralsCount: input.activeReferralsCount,
  });
}

export async function claimReferralMilestoneBonus(input: {
  client: SupabaseClient;
  userId: string;
  milestoneId: string;
  activeReferralsCount: number;
}): Promise<ReferralMilestoneClaimResult> {
  const milestoneId = String(input.milestoneId || "").trim();
  if (!milestoneId) {
    return { ok: false, reason: "MILESTONE_NOT_FOUND" };
  }

  const { data: milestoneRow } = await input.client
    .from("referral_milestones")
    .select("id, is_enabled, name, active_referrals_threshold, bonus_credits, created_at")
    .eq("id", milestoneId)
    .maybeSingle<ReferralMilestone>();

  const milestone = normalizeMilestone(milestoneRow || {});
  if (!milestone) return { ok: false, reason: "MILESTONE_NOT_FOUND" };
  if (!milestone.is_enabled) return { ok: false, reason: "MILESTONE_DISABLED" };

  const activeReferralsCount = Math.max(0, Math.trunc(Number(input.activeReferralsCount || 0)));
  if (activeReferralsCount < milestone.active_referrals_threshold) {
    return { ok: false, reason: "THRESHOLD_NOT_MET" };
  }

  const now = new Date().toISOString();

  const { data: existingClaim } = await input.client
    .from("referral_milestone_claims")
    .select("milestone_id, user_id, claimed_at")
    .eq("milestone_id", milestone.id)
    .eq("user_id", input.userId)
    .maybeSingle<ReferralMilestoneClaim>();

  const alreadyClaimed = Boolean(existingClaim?.milestone_id);

  if (!alreadyClaimed) {
    const { error: claimInsertError } = await input.client
      .from("referral_milestone_claims")
      .insert({
        milestone_id: milestone.id,
        user_id: input.userId,
        claimed_at: now,
      });

    if (claimInsertError && !isDuplicateKeyError(claimInsertError)) {
      return { ok: false, reason: "CLAIM_INSERT_FAILED" };
    }
  }

  const milestoneCreditSource = `referral_milestone_bonus:${milestone.id}`;
  const { error: creditError } = await input.client.from("listing_credits").insert({
    user_id: input.userId,
    source: milestoneCreditSource,
    credits_total: milestone.bonus_credits,
    credits_used: 0,
    created_at: now,
    updated_at: now,
  });

  if (creditError && !isDuplicateKeyError(creditError)) {
    return { ok: false, reason: "BONUS_ISSUE_FAILED" };
  }

  const { error: ledgerError } = await input.client.from("referral_credit_ledger").insert({
    user_id: input.userId,
    type: "earn",
    credits: milestone.bonus_credits,
    source_event: "referral_milestone_claimed",
    source_ref: milestone.id,
    reward_source: "unknown",
    created_at: now,
  });

  if (ledgerError && !isDuplicateKeyError(ledgerError)) {
    return { ok: false, reason: "BONUS_LEDGER_FAILED" };
  }

  try {
    await input.client.rpc("referral_sync_wallet_balance", {
      in_user_id: input.userId,
    });
  } catch {
    // Wallet sync is best effort.
  }

  return {
    ok: true,
    milestone,
    alreadyClaimed,
  };
}
