import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { parseAppSettingBool, parseAppSettingInt } from "@/lib/settings/app-settings";

export type ReferralRewardType = "listing_credit" | "featured_credit" | "discount";

export type ReferralRewardRule = {
  type: ReferralRewardType;
  amount: number;
};

export type ReferralTierThresholds = Record<string, number>;

export type ReferralCaps = {
  daily: number;
  monthly: number;
};

export type ReferralSettings = {
  enabled: boolean;
  maxDepth: number;
  enabledLevels: number[];
  rewardRules: Record<number, ReferralRewardRule>;
  tierThresholds: ReferralTierThresholds;
  caps: ReferralCaps;
};

type AppSettingRow = {
  key: string;
  value: unknown;
};

const DEFAULT_TIER_THRESHOLDS: ReferralTierThresholds = {
  Bronze: 0,
  Silver: 5,
  Gold: 15,
  Platinum: 30,
};

export const DEFAULT_REFERRAL_SETTINGS: ReferralSettings = {
  enabled: false,
  maxDepth: 5,
  enabledLevels: [1],
  rewardRules: {
    1: { type: "listing_credit", amount: 1 },
  },
  tierThresholds: DEFAULT_TIER_THRESHOLDS,
  caps: {
    daily: 50,
    monthly: 500,
  },
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function unwrapSettingValue(value: unknown): unknown {
  const obj = asObject(value);
  if (obj && "value" in obj) {
    return obj.value;
  }
  return value;
}

function clampDepth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_REFERRAL_SETTINGS.maxDepth;
  return Math.max(1, Math.min(5, Math.trunc(value)));
}

function parseEnabledLevels(value: unknown, maxDepth: number): number[] {
  const raw = unwrapSettingValue(value);
  const levels = Array.isArray(raw) ? raw : [];
  const parsed = levels
    .map((item) => (typeof item === "number" ? item : Number(item)))
    .filter((item) => Number.isFinite(item))
    .map((item) => Math.trunc(item))
    .filter((item) => item >= 1 && item <= 5 && item <= maxDepth);
  const deduped = Array.from(new Set(parsed)).sort((a, b) => a - b);
  return deduped.length ? deduped : DEFAULT_REFERRAL_SETTINGS.enabledLevels;
}

function normalizeRewardType(input: unknown): ReferralRewardType | null {
  if (typeof input !== "string") return null;
  if (input === "listing_credit" || input === "featured_credit" || input === "discount") {
    return input;
  }
  return null;
}

function parseRewardRules(value: unknown): Record<number, ReferralRewardRule> {
  const raw = asObject(unwrapSettingValue(value));
  if (!raw) return DEFAULT_REFERRAL_SETTINGS.rewardRules;

  const rules: Record<number, ReferralRewardRule> = {};

  for (const [key, rawRule] of Object.entries(raw)) {
    const level = Number(key);
    if (!Number.isFinite(level)) continue;
    const levelInt = Math.trunc(level);
    if (levelInt < 1 || levelInt > 5) continue;

    const ruleObj = asObject(rawRule);
    if (!ruleObj) continue;

    const type = normalizeRewardType(ruleObj.type);
    const amount = typeof ruleObj.amount === "number" ? ruleObj.amount : Number(ruleObj.amount);
    if (!type || !Number.isFinite(amount) || amount <= 0) continue;

    rules[levelInt] = {
      type,
      amount: Math.max(0, Number(amount.toFixed(4))),
    };
  }

  return Object.keys(rules).length ? rules : DEFAULT_REFERRAL_SETTINGS.rewardRules;
}

function titleizeTier(input: string): string {
  return input
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ");
}

function parseTierThresholds(value: unknown): ReferralTierThresholds {
  const raw = asObject(unwrapSettingValue(value));
  if (!raw) return DEFAULT_REFERRAL_SETTINGS.tierThresholds;

  const pairs = Object.entries(raw)
    .map(([name, threshold]) => {
      const num = typeof threshold === "number" ? threshold : Number(threshold);
      if (!Number.isFinite(num)) return null;
      const cleanName = titleizeTier(name);
      if (!cleanName) return null;
      return [cleanName, Math.max(0, Math.trunc(num))] as const;
    })
    .filter((entry): entry is readonly [string, number] => !!entry);

  if (!pairs.length) return DEFAULT_REFERRAL_SETTINGS.tierThresholds;

  const sorted = pairs.sort((a, b) => a[1] - b[1]);
  return Object.fromEntries(sorted);
}

function parseCaps(value: unknown): ReferralCaps {
  const raw = asObject(unwrapSettingValue(value));
  if (!raw) return DEFAULT_REFERRAL_SETTINGS.caps;

  const daily = typeof raw.daily === "number" ? raw.daily : Number(raw.daily);
  const monthly = typeof raw.monthly === "number" ? raw.monthly : Number(raw.monthly);

  return {
    daily: Number.isFinite(daily)
      ? Math.max(0, Math.trunc(daily))
      : DEFAULT_REFERRAL_SETTINGS.caps.daily,
    monthly: Number.isFinite(monthly)
      ? Math.max(0, Math.trunc(monthly))
      : DEFAULT_REFERRAL_SETTINGS.caps.monthly,
  };
}

export function parseReferralSettingsRows(rows: AppSettingRow[]): ReferralSettings {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  const enabled = parseAppSettingBool(
    byKey.get(APP_SETTING_KEYS.referralsEnabled),
    DEFAULT_REFERRAL_SETTINGS.enabled
  );
  const maxDepth = clampDepth(
    parseAppSettingInt(
      byKey.get(APP_SETTING_KEYS.referralMaxDepth),
      DEFAULT_REFERRAL_SETTINGS.maxDepth
    )
  );
  const enabledLevels = parseEnabledLevels(
    byKey.get(APP_SETTING_KEYS.referralEnabledLevels),
    maxDepth
  );
  const rewardRules = parseRewardRules(byKey.get(APP_SETTING_KEYS.referralRewardRules));
  const tierThresholds = parseTierThresholds(byKey.get(APP_SETTING_KEYS.referralTierThresholds));
  const caps = parseCaps(byKey.get(APP_SETTING_KEYS.referralCaps));

  return {
    enabled,
    maxDepth,
    enabledLevels,
    rewardRules,
    tierThresholds,
    caps,
  };
}

export async function getReferralSettings(client?: SupabaseClient): Promise<ReferralSettings> {
  if (!client && !hasServerSupabaseEnv()) return DEFAULT_REFERRAL_SETTINGS;

  try {
    const supabase = client ?? (await createServerSupabaseClient());
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        APP_SETTING_KEYS.referralsEnabled,
        APP_SETTING_KEYS.referralMaxDepth,
        APP_SETTING_KEYS.referralEnabledLevels,
        APP_SETTING_KEYS.referralRewardRules,
        APP_SETTING_KEYS.referralTierThresholds,
        APP_SETTING_KEYS.referralCaps,
      ]);

    if (error) return DEFAULT_REFERRAL_SETTINGS;

    return parseReferralSettingsRows((data as AppSettingRow[] | null) ?? []);
  } catch {
    return DEFAULT_REFERRAL_SETTINGS;
  }
}

export type ReferralTierStatus = {
  currentTier: string;
  nextTier: string | null;
  currentThreshold: number;
  nextThreshold: number | null;
  progressToNext: number;
};

export function resolveReferralTierStatus(
  value: number,
  thresholds: ReferralTierThresholds
): ReferralTierStatus {
  const points = Math.max(0, Math.trunc(value));
  const ordered = Object.entries(thresholds)
    .filter((entry) => Number.isFinite(entry[1]))
    .sort((a, b) => a[1] - b[1]);

  if (!ordered.length) {
    return {
      currentTier: "Bronze",
      nextTier: null,
      currentThreshold: 0,
      nextThreshold: null,
      progressToNext: 100,
    };
  }

  let current = ordered[0];
  let next: [string, number] | null = null;

  for (let i = 0; i < ordered.length; i += 1) {
    const candidate = ordered[i];
    if (points >= candidate[1]) {
      current = candidate;
      next = ordered[i + 1] ?? null;
    }
  }

  if (!next) {
    return {
      currentTier: current[0],
      nextTier: null,
      currentThreshold: current[1],
      nextThreshold: null,
      progressToNext: 100,
    };
  }

  const span = Math.max(1, next[1] - current[1]);
  const progressed = Math.max(0, points - current[1]);
  const ratio = Math.max(0, Math.min(100, Math.round((progressed / span) * 100)));

  return {
    currentTier: current[0],
    nextTier: next[0],
    currentThreshold: current[1],
    nextThreshold: next[1],
    progressToNext: ratio,
  };
}
