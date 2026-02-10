import type { SupabaseClient } from "@supabase/supabase-js";
import { getReferralSettings, type ReferralRewardType } from "@/lib/referrals/settings";
import { logPaidEventForReferredUser } from "@/lib/referrals/share-tracking.server";

const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type ReferralCodeRow = {
  user_id: string;
  code: string;
};

type ReferralRow = {
  referred_user_id: string;
  referrer_user_id: string;
  depth: number;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

type ReferralRewardSumRow = {
  reward_amount: number | null;
};

type CreditRow = {
  credits_total: number | null;
  credits_used?: number | null;
  source?: string | null;
};

type MilestoneLedgerRow = {
  source_ref: string;
  credits: number | null;
  created_at: string;
};

export type ReferralCaptureResult =
  | { ok: true; captured: boolean; reason?: string; depth?: number; referrerUserId?: string }
  | { ok: false; error: string };

export type ReferralRewardIssueResult = {
  issued: number;
  skipped: number;
  reason?: string;
};

export function generateReferralCodeCandidate(length = 8, random = Math.random): string {
  let output = "";
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(random() * REFERRAL_CODE_ALPHABET.length);
    output += REFERRAL_CODE_ALPHABET[index] || REFERRAL_CODE_ALPHABET[0];
  }
  return output;
}

function isUniqueConstraintError(error: unknown, constraint: string): boolean {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";
  if (code === "23505") return true;
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  return message.toLowerCase().includes(constraint.toLowerCase());
}

export async function ensureReferralCode(input: {
  client: SupabaseClient;
  userId: string;
  maxAttempts?: number;
}): Promise<{ code: string | null; created: boolean }> {
  const { client, userId, maxAttempts = 16 } = input;

  const { data: existing } = await client
    .from("referral_codes")
    .select("user_id, code")
    .eq("user_id", userId)
    .maybeSingle<ReferralCodeRow>();

  if (existing?.code) {
    return { code: existing.code, created: false };
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateReferralCodeCandidate();
    const now = new Date().toISOString();
    const { data, error } = await client
      .from("referral_codes")
      .insert({ user_id: userId, code: candidate, created_at: now })
      .select("user_id, code")
      .maybeSingle<ReferralCodeRow>();

    if (!error && data?.code) {
      return { code: data.code, created: true };
    }

    if (isUniqueConstraintError(error, "referral_codes_code_key")) {
      continue;
    }

    if (isUniqueConstraintError(error, "referral_codes_pkey")) {
      const { data: fallback } = await client
        .from("referral_codes")
        .select("user_id, code")
        .eq("user_id", userId)
        .maybeSingle<ReferralCodeRow>();
      return { code: fallback?.code ?? null, created: false };
    }

    return { code: null, created: false };
  }

  return { code: null, created: false };
}

export async function captureReferralForUser(input: {
  client: SupabaseClient;
  referredUserId: string;
  referralCode: string;
  maxDepth?: number;
}): Promise<ReferralCaptureResult> {
  const { client, referredUserId, maxDepth = 5 } = input;
  const referralCode = input.referralCode.trim().toUpperCase();

  if (!referredUserId || !referralCode) {
    return { ok: true, captured: false, reason: "missing_input" };
  }

  const { data: existing } = await client
    .from("referrals")
    .select("id")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();
  if (existing?.id) {
    return { ok: true, captured: false, reason: "already_linked" };
  }

  const { data: codeRow } = await client
    .from("referral_codes")
    .select("user_id, code")
    .eq("code", referralCode)
    .maybeSingle<ReferralCodeRow>();

  if (!codeRow?.user_id) {
    return { ok: true, captured: false, reason: "invalid_code" };
  }

  if (codeRow.user_id === referredUserId) {
    return { ok: true, captured: false, reason: "self_referral" };
  }

  const { data: parent } = await client
    .from("referrals")
    .select("depth")
    .eq("referred_user_id", codeRow.user_id)
    .maybeSingle<{ depth: number | null }>();

  const parentDepth = Math.max(0, Number(parent?.depth || 0));
  const depth = parentDepth + 1;
  if (depth > Math.max(1, Math.min(5, maxDepth))) {
    return { ok: true, captured: false, reason: "depth_limit" };
  }

  const { error } = await client.from("referrals").insert({
    referred_user_id: referredUserId,
    referrer_user_id: codeRow.user_id,
    depth,
    created_at: new Date().toISOString(),
  });

  if (error) {
    if (isUniqueConstraintError(error, "referrals_referred_user_id_key")) {
      return { ok: true, captured: false, reason: "already_linked" };
    }
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    captured: true,
    depth,
    referrerUserId: codeRow.user_id,
  };
}

export async function getReferralAncestors(input: {
  client: SupabaseClient;
  userId: string;
  maxDepth?: number;
}): Promise<Array<{ userId: string; level: number }>> {
  const { client, userId, maxDepth = 5 } = input;
  const chain: Array<{ userId: string; level: number }> = [];
  const seen = new Set<string>();
  let cursor = userId;

  for (let level = 1; level <= Math.max(1, Math.min(5, maxDepth)); level += 1) {
    const { data } = await client
      .from("referrals")
      .select("referrer_user_id")
      .eq("referred_user_id", cursor)
      .maybeSingle<{ referrer_user_id: string | null }>();

    const parent = data?.referrer_user_id;
    if (!parent || seen.has(parent)) break;

    chain.push({ userId: parent, level });
    seen.add(parent);
    cursor = parent;
  }

  return chain;
}

function getMonthStartIso(inputIso: string): string {
  const dt = new Date(inputIso);
  const start = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1, 0, 0, 0, 0));
  return start.toISOString();
}

function getDayStartIso(inputIso: string): string {
  const dt = new Date(inputIso);
  const start = new Date(
    Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), 0, 0, 0, 0)
  );
  return start.toISOString();
}

async function getRewardSumSince(input: {
  client: SupabaseClient;
  referrerUserId: string;
  sinceIso: string;
}): Promise<number> {
  const { client, referrerUserId, sinceIso } = input;
  const { data } = await client
    .from("referral_rewards")
    .select("reward_amount")
    .eq("referrer_user_id", referrerUserId)
    .gte("issued_at", sinceIso);

  const rows = (data as ReferralRewardSumRow[] | null) ?? [];
  return rows.reduce((sum, row) => sum + Math.max(0, Number(row.reward_amount || 0)), 0);
}

async function upsertOutstandingCredits(input: {
  client: SupabaseClient;
  referrerUserId: string;
  rewardType: ReferralRewardType;
  rewardSource: "payg_listing_fee_paid" | "featured_purchase_paid" | "subscription_paid";
  nowIso: string;
}) {
  const { client, referrerUserId, rewardType, rewardSource, nowIso } = input;
  if (rewardType !== "listing_credit" && rewardType !== "featured_credit") return;

  const source =
    rewardType === "listing_credit" ? "referral_listing_credit" : "referral_featured_credit";

  const { data: rewardRows } = await client
    .from("referral_rewards")
    .select("reward_amount")
    .eq("referrer_user_id", referrerUserId)
    .eq("reward_type", rewardType);

  const earnedRaw = ((rewardRows as ReferralRewardSumRow[] | null) ?? []).reduce(
    (sum, row) => sum + Math.max(0, Number(row.reward_amount || 0)),
    0
  );
  const earnedWhole = Math.floor(earnedRaw);
  if (earnedWhole <= 0) return;

  const creditTable = rewardType === "listing_credit" ? "listing_credits" : "featured_credits";
  const { data: creditRows } = await client
    .from(creditTable)
    .select("credits_total")
    .eq("user_id", referrerUserId)
    .eq("source", source);

  const issuedWhole = ((creditRows as CreditRow[] | null) ?? []).reduce(
    (sum, row) => sum + Math.max(0, Number(row.credits_total || 0)),
    0
  );

  const grant = Math.max(0, earnedWhole - issuedWhole);
  if (grant <= 0) return;

  const { error } = await client.from(creditTable).insert({
    user_id: referrerUserId,
    source,
    credits_total: grant,
    credits_used: 0,
    created_at: nowIso,
    updated_at: nowIso,
  });

  if (error) return;

  try {
    await client.from("referral_credit_ledger").insert({
      user_id: referrerUserId,
      type: "earn",
      credits: grant,
      source_event: "referral_reward_issued",
      source_ref: `${source}:${nowIso}`,
      reward_source: rewardSource,
      created_at: nowIso,
    });
  } catch {
    // Ledger writes are best effort and should not block credit issuance.
  }

  try {
    const rpc = (client as unknown as { rpc?: (...args: unknown[]) => Promise<unknown> }).rpc;
    if (typeof rpc === "function") {
      await rpc("referral_sync_wallet_balance", {
        in_user_id: referrerUserId,
      });
    }
  } catch {
    // Wallet sync is best effort and should not block reward issuance.
  }
}

export async function issueReferralRewardsForEvent(input: {
  client: SupabaseClient;
  referredUserId: string;
  eventType: "payg_listing_fee_paid" | "featured_purchase_paid" | "subscription_paid";
  eventReference: string;
  issuedAt?: string;
}): Promise<ReferralRewardIssueResult> {
  const { client, referredUserId, eventType, eventReference } = input;
  const issuedAt = input.issuedAt ?? new Date().toISOString();

  if (!referredUserId || !eventReference) {
    return { issued: 0, skipped: 0, reason: "missing_input" };
  }

  const settings = await getReferralSettings(client);
  if (!settings.enabled) {
    return { issued: 0, skipped: 0, reason: "disabled" };
  }

  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", referredUserId)
    .maybeSingle<{ role: string | null }>();

  if (profile?.role !== "agent") {
    return { issued: 0, skipped: 0, reason: "not_agent" };
  }

  const ancestors = await getReferralAncestors({
    client,
    userId: referredUserId,
    maxDepth: settings.maxDepth,
  });
  if (!ancestors.length) {
    return { issued: 0, skipped: 0, reason: "no_ancestors" };
  }

  let issued = 0;
  let skipped = 0;

  for (const ancestor of ancestors) {
    if (!settings.enabledLevels.includes(ancestor.level)) {
      skipped += 1;
      continue;
    }

    const rule = settings.rewardRules[ancestor.level];
    if (!rule) {
      skipped += 1;
      continue;
    }

    const amount = Math.max(0, Number(rule.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      skipped += 1;
      continue;
    }

    const dailySum = await getRewardSumSince({
      client,
      referrerUserId: ancestor.userId,
      sinceIso: getDayStartIso(issuedAt),
    });
    if (settings.caps.daily > 0 && dailySum + amount > settings.caps.daily) {
      skipped += 1;
      continue;
    }

    const monthlySum = await getRewardSumSince({
      client,
      referrerUserId: ancestor.userId,
      sinceIso: getMonthStartIso(issuedAt),
    });
    if (settings.caps.monthly > 0 && monthlySum + amount > settings.caps.monthly) {
      skipped += 1;
      continue;
    }

    const { error } = await client.from("referral_rewards").insert({
      referrer_user_id: ancestor.userId,
      referred_user_id: referredUserId,
      level: ancestor.level,
      event_type: eventType,
      event_reference: eventReference,
      reward_type: rule.type,
      reward_amount: Number(amount.toFixed(4)),
      issued_at: issuedAt,
    });

    if (error) {
      if (isUniqueConstraintError(error, "referral_rewards")) {
        skipped += 1;
        continue;
      }
      skipped += 1;
      continue;
    }

    issued += 1;
    await upsertOutstandingCredits({
      client,
      referrerUserId: ancestor.userId,
      rewardType: rule.type,
      rewardSource: eventType,
      nowIso: issuedAt,
    });
  }

  try {
    await logPaidEventForReferredUser(client, referredUserId);
  } catch {
    // Tracking is non-blocking and should never fail payout issuance.
  }

  return { issued, skipped };
}

export type ReferralTreeNode = {
  userId: string;
  level: number;
  depth: number;
  joinedAt: string;
  label: string;
  status: "pending" | "active";
};

export type ReferralDashboardSnapshot = {
  totalReferrals: number;
  directReferrals: number;
  indirectReferrals: number;
  verifiedReferrals: number;
  creditsEarnedTotal: number;
  creditsEarnedByLevel: Record<number, number>;
  creditsIssuedTotal: number;
  creditsUsedTotal: number;
  tree: Record<number, ReferralTreeNode[]>;
  recentActivity: Array<{
    id: string;
    referredUserId: string;
    level: number;
    rewardType: string;
    rewardAmount: number;
    issuedAt: string;
    label: string;
    eventType: string;
  }>;
};

function shortAgentLabel(userId: string): string {
  return `Agent ${userId.slice(0, 8)}`;
}

function resolveAgentLabel(userId: string, profileMap: Map<string, string>): string {
  const label = profileMap.get(userId);
  if (label && label.trim().length) return label.trim();
  return shortAgentLabel(userId);
}

export async function getReferralDashboardSnapshot(input: {
  client: SupabaseClient;
  userId: string;
  maxDepth?: number;
}): Promise<ReferralDashboardSnapshot> {
  const { client, userId } = input;
  const maxDepth = Math.max(1, Math.min(5, input.maxDepth ?? 5));

  const [
    { data: referralsData },
    { data: rewardsData },
    { data: listingCredits },
    { data: featuredCredits },
    { data: milestoneLedgerRows },
  ] =
    await Promise.all([
      client
        .from("referrals")
        .select("referred_user_id, referrer_user_id, depth, created_at")
        .order("created_at", { ascending: false }),
      client
        .from("referral_rewards")
        .select("id, referred_user_id, level, reward_type, reward_amount, issued_at, event_type")
        .eq("referrer_user_id", userId)
        .order("issued_at", { ascending: false })
        .limit(100),
      client
        .from("listing_credits")
        .select("credits_total, credits_used, source")
        .eq("user_id", userId)
        .ilike("source", "referral_%"),
      client
        .from("featured_credits")
        .select("credits_total, credits_used")
        .eq("user_id", userId)
        .eq("source", "referral_featured_credit"),
      client
        .from("referral_credit_ledger")
        .select("source_ref, credits, created_at")
        .eq("user_id", userId)
        .eq("type", "earn")
        .eq("source_event", "referral_milestone_claimed")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

  const referrals = (referralsData as ReferralRow[] | null) ?? [];
  const rewards =
    ((rewardsData as Array<{
      id: string;
      referred_user_id: string;
      level: number;
      reward_type: string;
      reward_amount: number;
      issued_at: string;
      event_type: string;
    }> | null) ?? []);
  const activeReferralIds = new Set(rewards.map((reward) => reward.referred_user_id));

  const childrenMap = new Map<string, ReferralRow[]>();
  for (const row of referrals) {
    const list = childrenMap.get(row.referrer_user_id) ?? [];
    list.push(row);
    childrenMap.set(row.referrer_user_id, list);
  }

  const tree: Record<number, ReferralTreeNode[]> = {};
  const queue: Array<{ id: string; level: number }> = [{ id: userId, level: 0 }];
  const seen = new Set<string>();

  while (queue.length) {
    const current = queue.shift();
    if (!current) break;

    const children = childrenMap.get(current.id) ?? [];
    for (const child of children) {
      if (seen.has(child.referred_user_id)) continue;
      const level = current.level + 1;
      if (level > maxDepth) continue;

      const node: ReferralTreeNode = {
        userId: child.referred_user_id,
        level,
        depth: child.depth,
        joinedAt: child.created_at,
        label: shortAgentLabel(child.referred_user_id),
        status: activeReferralIds.has(child.referred_user_id) ? "active" : "pending",
      };

      tree[level] = tree[level] ?? [];
      tree[level].push(node);
      seen.add(child.referred_user_id);
      queue.push({ id: child.referred_user_id, level });
    }
  }

  const totalReferrals = Object.values(tree).reduce((sum, items) => sum + items.length, 0);
  const directReferrals = (tree[1] ?? []).length;
  const indirectReferrals = Math.max(0, totalReferrals - directReferrals);

  const verifiedReferrals = new Set(rewards.map((reward) => reward.referred_user_id)).size;
  const creditsEarnedByLevel = rewards.reduce<Record<number, number>>((acc, reward) => {
    const level = Math.max(1, Math.min(5, Number(reward.level || 1)));
    acc[level] = (acc[level] ?? 0) + Math.max(0, Number(reward.reward_amount || 0));
    return acc;
  }, {});
  const baseCreditsEarnedTotal = Object.values(creditsEarnedByLevel).reduce(
    (sum, amount) => sum + amount,
    0
  );

  const listingRows = ((listingCredits as CreditRow[] | null) ?? []).filter((row) => {
    const source = String(row.source || "");
    return source === "referral_listing_credit" || source.startsWith("referral_milestone_bonus:");
  });
  const milestoneCreditRows = listingRows.filter((row) =>
    String(row.source || "").startsWith("referral_milestone_bonus:")
  );
  const milestoneBonusEarned = milestoneCreditRows.reduce(
    (sum, row) => sum + Math.max(0, Number(row.credits_total || 0)),
    0
  );
  const creditsEarnedTotal = baseCreditsEarnedTotal + milestoneBonusEarned;

  const issuedRows = [...listingRows, ...(((featuredCredits as CreditRow[] | null) ?? []))];
  const creditsIssuedTotal = issuedRows.reduce(
    (sum, row) => sum + Math.max(0, Number(row.credits_total || 0)),
    0
  );
  const creditsUsedTotal = issuedRows.reduce(
    (sum, row) => sum + Math.max(0, Number(row.credits_used || 0)),
    0
  );

  const profileIds = new Set<string>();
  for (const levelNodes of Object.values(tree)) {
    for (const node of levelNodes) profileIds.add(node.userId);
  }
  for (const reward of rewards) profileIds.add(reward.referred_user_id);

  const profileMap = new Map<string, string>();
  if (profileIds.size > 0) {
    const { data: profileRows } = await client
      .from("profiles")
      .select("id, full_name")
      .in("id", Array.from(profileIds));
    for (const profile of ((profileRows as ProfileRow[] | null) ?? [])) {
      if (profile?.id && typeof profile.full_name === "string" && profile.full_name.trim().length > 0) {
        profileMap.set(profile.id, profile.full_name.trim());
      }
    }
  }

  for (const levelNodes of Object.values(tree)) {
    for (const node of levelNodes) {
      node.label = resolveAgentLabel(node.userId, profileMap);
    }
  }

  const rewardActivity = rewards.map((reward) => ({
    id: reward.id,
    referredUserId: reward.referred_user_id,
    level: reward.level,
    rewardType: reward.reward_type,
    rewardAmount: Number(Math.max(0, reward.reward_amount).toFixed(2)),
    issuedAt: reward.issued_at,
    label: resolveAgentLabel(reward.referred_user_id, profileMap),
    eventType: reward.event_type,
  }));

  const milestoneActivity = ((milestoneLedgerRows as MilestoneLedgerRow[] | null) ?? []).map(
    (row) => ({
      id: `milestone:${row.source_ref}:${row.created_at}`,
      referredUserId: userId,
      level: 0,
      rewardType: "milestone_bonus",
      rewardAmount: Math.max(0, Number(row.credits || 0)),
      issuedAt: row.created_at,
      label: "Milestone bonus",
      eventType: "referral_milestone_claimed",
    })
  );

  const fallbackActivity = Object.values(tree)
    .flat()
    .map((node) => ({
      id: `joined:${node.userId}:${node.joinedAt}`,
      referredUserId: node.userId,
      level: node.level,
      rewardType: "pending",
      rewardAmount: 0,
      issuedAt: node.joinedAt,
      label: node.label,
      eventType: "referral_joined",
    }))
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());

  const recentActivity = (
    rewardActivity.length
      ? [...rewardActivity, ...milestoneActivity].sort(
          (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()
        )
      : fallbackActivity
  ).slice(0, 10);

  return {
    totalReferrals,
    directReferrals,
    indirectReferrals,
    verifiedReferrals,
    creditsEarnedTotal,
    creditsEarnedByLevel,
    creditsIssuedTotal,
    creditsUsedTotal,
    tree,
    recentActivity,
  };
}
