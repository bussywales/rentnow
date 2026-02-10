import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAppSettingBool } from "@/lib/settings/app-settings";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { resolveReferralTierStatus, type ReferralTierThresholds } from "@/lib/referrals/settings";

export type ReferralLeaderboardWindow = "month" | "all_time";

export type ReferralLeaderboardEntry = {
  userId: string;
  rank: number;
  displayName: string;
  tier: string;
  activeReferrals: number;
  joinedAt: string | null;
  isYou: boolean;
};

export type ReferralLeaderboardWindowSnapshot = {
  window: ReferralLeaderboardWindow;
  label: string;
  entries: ReferralLeaderboardEntry[];
  myRank: number | null;
  myActiveReferrals: number;
  totalAgents: number;
};

export type ReferralLeaderboardConfig = {
  enabled: boolean;
  publicVisible: boolean;
  monthlyEnabled: boolean;
  allTimeEnabled: boolean;
  initialsOnly: boolean;
  scope: "global" | "by_country" | "by_city";
};

export type ReferralLeaderboardSnapshot = {
  enabled: boolean;
  publicVisible: boolean;
  availableWindows: ReferralLeaderboardWindow[];
  defaultWindow: ReferralLeaderboardWindow;
  userOptedOut: boolean;
  windows: ReferralLeaderboardWindowSnapshot[];
};

type LeaderboardAgentProfile = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  created_at: string | null;
};

type LeaderboardRewardRow = {
  referrer_user_id: string;
  referred_user_id: string;
  issued_at: string;
};

type AppSettingRow = {
  key: string;
  value: unknown;
};

type LeaderboardBaseData = {
  agents: LeaderboardAgentProfile[];
  rewards: LeaderboardRewardRow[];
  optOutByUserId: Record<string, boolean>;
};

type LeaderboardRankInput = {
  userId: string;
  displayName: string;
  tier: string;
  activeReferrals: number;
  optedOut: boolean;
  joinedAt: string | null;
};

const LEADERBOARD_OPT_OUT_PREFIX = "referrals_leaderboard_opt_out:";
const MONTHLY_LABEL = "This month";
const ALL_TIME_LABEL = "All time";

function getMonthStartIso(now = new Date()): string {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  return monthStart.toISOString();
}

function normalizeDisplayName(input: {
  name: string | null | undefined;
  userId: string;
  initialsOnly: boolean;
}): string {
  const { name, userId, initialsOnly } = input;
  const raw = String(name || "").trim().replace(/\s+/g, " ");
  if (!raw) return `Agent ${userId.slice(0, 6)}`;

  if (!initialsOnly) return raw;

  const parts = raw.split(" ").filter(Boolean);
  if (parts.length <= 1) {
    const first = parts[0] || raw || "A";
    return `${first.charAt(0).toUpperCase()}.`;
  }

  const firstInitial = parts[0]?.charAt(0).toUpperCase() || "A";
  const surname = parts[parts.length - 1] || "";
  return `${firstInitial}. ${surname}`;
}

function rankLeaderboardRows(rows: LeaderboardRankInput[]): ReferralLeaderboardEntry[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.activeReferrals !== b.activeReferrals) {
      return b.activeReferrals - a.activeReferrals;
    }
    const byName = a.displayName.localeCompare(b.displayName);
    if (byName !== 0) return byName;
    return a.userId.localeCompare(b.userId);
  });

  let lastScore: number | null = null;
  let rank = 0;

  return sorted.map((row, index) => {
    if (lastScore === null || row.activeReferrals < lastScore) {
      rank = index + 1;
      lastScore = row.activeReferrals;
    }
    return {
      userId: row.userId,
      rank,
      displayName: row.displayName,
      tier: row.tier,
      activeReferrals: row.activeReferrals,
      joinedAt: row.joinedAt,
      isYou: false,
    };
  });
}

function countDistinctActiveReferralsByReferrer(input: {
  rewards: LeaderboardRewardRow[];
  sinceIso: string | null;
}): Map<string, number> {
  const uniqueMap = new Map<string, Set<string>>();
  for (const reward of input.rewards) {
    if (input.sinceIso && reward.issued_at < input.sinceIso) continue;
    const userId = String(reward.referrer_user_id || "");
    const referredUserId = String(reward.referred_user_id || "");
    if (!userId || !referredUserId) continue;

    const existing = uniqueMap.get(userId) ?? new Set<string>();
    existing.add(referredUserId);
    uniqueMap.set(userId, existing);
  }

  const counts = new Map<string, number>();
  for (const [userId, referredSet] of uniqueMap.entries()) {
    counts.set(userId, referredSet.size);
  }
  return counts;
}

const getLeaderboardBaseData = unstable_cache(
  async (): Promise<LeaderboardBaseData> => {
    if (!hasServiceRoleEnv()) {
      return { agents: [], rewards: [], optOutByUserId: {} };
    }

    const client = createServiceRoleClient() as unknown as SupabaseClient;
    const [profilesResult, rewardsResult, appSettingResult] = await Promise.all([
      client
        .from("profiles")
        .select("id, display_name, full_name, created_at")
        .in("role", ["agent", "landlord"]),
      client
        .from("referral_rewards")
        .select("referrer_user_id, referred_user_id, issued_at"),
      client
        .from("app_settings")
        .select("key, value")
        .like("key", `${LEADERBOARD_OPT_OUT_PREFIX}%`),
    ]);

    const agents = ((profilesResult.data as LeaderboardAgentProfile[] | null) ?? []).map((row) => ({
      id: String(row.id),
      display_name: row.display_name ? String(row.display_name) : null,
      full_name: row.full_name ? String(row.full_name) : null,
      created_at: row.created_at ? String(row.created_at) : null,
    }));

    const rewards = ((rewardsResult.data as LeaderboardRewardRow[] | null) ?? []).map((row) => ({
      referrer_user_id: String(row.referrer_user_id || ""),
      referred_user_id: String(row.referred_user_id || ""),
      issued_at: String(row.issued_at || ""),
    }));

    const optOutByUserId: Record<string, boolean> = {};
    for (const setting of ((appSettingResult.data as AppSettingRow[] | null) ?? [])) {
      const key = String(setting.key || "");
      if (!key.startsWith(LEADERBOARD_OPT_OUT_PREFIX)) continue;
      const userId = key.slice(LEADERBOARD_OPT_OUT_PREFIX.length);
      if (!userId) continue;
      optOutByUserId[userId] = parseAppSettingBool(setting.value, false);
    }

    return {
      agents,
      rewards,
      optOutByUserId,
    };
  },
  ["referral-leaderboard-base-v1"],
  { revalidate: 600 }
);

function toWindowLabel(window: ReferralLeaderboardWindow): string {
  return window === "month" ? MONTHLY_LABEL : ALL_TIME_LABEL;
}

function buildWindowSnapshot(input: {
  window: ReferralLeaderboardWindow;
  rows: LeaderboardRankInput[];
  userId: string;
  publicVisible: boolean;
  topLimit: number;
}): ReferralLeaderboardWindowSnapshot {
  const ranked = rankLeaderboardRows(input.rows);
  const me = ranked.find((row) => row.userId === input.userId) ?? null;

  const entries = input.publicVisible
    ? ranked
        .filter((row) => !input.rows.find((candidate) => candidate.userId === row.userId)?.optedOut)
        .slice(0, Math.max(1, input.topLimit))
        .map((row) => ({
          ...row,
          isYou: row.userId === input.userId,
        }))
    : [];

  return {
    window: input.window,
    label: toWindowLabel(input.window),
    entries,
    myRank: me?.rank ?? null,
    myActiveReferrals: me?.activeReferrals ?? 0,
    totalAgents: ranked.length,
  };
}

export async function getReferralLeaderboardSnapshot(input: {
  userId: string;
  tierThresholds: ReferralTierThresholds;
  config: ReferralLeaderboardConfig;
  topLimit?: number;
}): Promise<ReferralLeaderboardSnapshot> {
  const availableWindows: ReferralLeaderboardWindow[] = [];
  if (input.config.monthlyEnabled) availableWindows.push("month");
  if (input.config.allTimeEnabled) availableWindows.push("all_time");

  const fallbackWindows = availableWindows.length ? availableWindows : (["all_time"] as ReferralLeaderboardWindow[]);
  const defaultWindow: ReferralLeaderboardWindow = fallbackWindows.includes("month")
    ? "month"
    : "all_time";

  if (!input.config.enabled) {
    return {
      enabled: false,
      publicVisible: input.config.publicVisible,
      availableWindows: fallbackWindows,
      defaultWindow,
      userOptedOut: false,
      windows: fallbackWindows.map((window) => ({
        window,
        label: toWindowLabel(window),
        entries: [],
        myRank: null,
        myActiveReferrals: 0,
        totalAgents: 0,
      })),
    };
  }

  const baseData = await getLeaderboardBaseData();
  const monthStartIso = getMonthStartIso();
  const monthlyCounts = countDistinctActiveReferralsByReferrer({
    rewards: baseData.rewards,
    sinceIso: monthStartIso,
  });
  const allTimeCounts = countDistinctActiveReferralsByReferrer({
    rewards: baseData.rewards,
    sinceIso: null,
  });
  const userOptedOut = Boolean(baseData.optOutByUserId[input.userId]);
  const topLimit = Math.max(1, Math.min(100, Math.trunc(input.topLimit ?? 10)));

  const monthlyRows: LeaderboardRankInput[] = baseData.agents.map((agent) => {
    const activeReferrals = monthlyCounts.get(agent.id) ?? 0;
    return {
      userId: agent.id,
      displayName: normalizeDisplayName({
        name: agent.display_name ?? agent.full_name,
        userId: agent.id,
        initialsOnly: input.config.initialsOnly,
      }),
      tier: resolveReferralTierStatus(activeReferrals, input.tierThresholds).currentTier,
      activeReferrals,
      optedOut: Boolean(baseData.optOutByUserId[agent.id]),
      joinedAt: agent.created_at,
    };
  });
  const allTimeRows: LeaderboardRankInput[] = baseData.agents.map((agent) => {
    const activeReferrals = allTimeCounts.get(agent.id) ?? 0;
    return {
      userId: agent.id,
      displayName: normalizeDisplayName({
        name: agent.display_name ?? agent.full_name,
        userId: agent.id,
        initialsOnly: input.config.initialsOnly,
      }),
      tier: resolveReferralTierStatus(activeReferrals, input.tierThresholds).currentTier,
      activeReferrals,
      optedOut: Boolean(baseData.optOutByUserId[agent.id]),
      joinedAt: agent.created_at,
    };
  });

  const windows = fallbackWindows.map((window) =>
    buildWindowSnapshot({
      window,
      rows: window === "month" ? monthlyRows : allTimeRows,
      userId: input.userId,
      publicVisible: input.config.publicVisible,
      topLimit,
    })
  );

  return {
    enabled: true,
    publicVisible: input.config.publicVisible,
    availableWindows: fallbackWindows,
    defaultWindow,
    userOptedOut,
    windows,
  };
}

export async function getReferralLeaderboardOptOut(input: {
  client: SupabaseClient;
  userId: string;
}): Promise<boolean> {
  const key = `${LEADERBOARD_OPT_OUT_PREFIX}${input.userId}`;
  const { data } = await input.client
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle<{ value: unknown }>();
  return parseAppSettingBool(data?.value, false);
}

export const REFERRAL_LEADERBOARD_OPT_OUT_PREFIX = LEADERBOARD_OPT_OUT_PREFIX;
export { rankLeaderboardRows, normalizeDisplayName };
