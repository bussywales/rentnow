import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAppSettingBool, parseAppSettingInt } from "@/lib/settings/app-settings";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getSiteUrl } from "@/lib/env";

export const REFERRAL_SHARE_CHANNELS = [
  "whatsapp",
  "email",
  "linkedin",
  "facebook",
  "x",
  "sms",
  "qr",
  "copy",
  "other",
] as const;

export type ReferralShareChannel = (typeof REFERRAL_SHARE_CHANNELS)[number];

export type ReferralCampaignRecord = {
  id: string;
  owner_id: string;
  referral_code: string;
  name: string;
  channel: ReferralShareChannel;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  landing_path: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ReferralTrackingSettings = {
  enabled: boolean;
  attributionWindowDays: number;
  storeIpHash: boolean;
};

export type ReferralCampaignInput = {
  name: string;
  channel: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  landing_path?: string | null;
};

export type ReferralTouchEventInput = {
  campaignId?: string | null;
  referralCode?: string | null;
  eventType: "click" | "captured" | "signup" | "paid_event";
  anonId?: string | null;
  viewerUserId?: string | null;
  referredUserId?: string | null;
  userAgent?: string | null;
  ipHash?: string | null;
  countryCode?: string | null;
  city?: string | null;
  referrerUrl?: string | null;
  landingUrl?: string | null;
};

export type ReferralCampaignMetrics = {
  campaignId: string;
  clicks: number;
  clicks30d: number;
  captures: number;
  activeReferrals: number;
  earningsCredits: number;
  conversionRate: number;
};

export type ReferralOwnerAnalytics = {
  totals: {
    clicks: number;
    captures: number;
    activeReferrals: number;
    earningsCredits: number;
  };
  campaigns: Array<ReferralCampaignRecord & ReferralCampaignMetrics & { shareLink: string }>;
};

type AppSettingRow = { key: string; value: unknown };

type AttributionRow = {
  id: string;
  campaign_id: string | null;
  referral_code: string;
  referred_user_id: string;
  referrer_owner_id: string;
  first_touch_event_id: string | null;
  captured_event_id: string | null;
  created_at: string;
};

type TouchRow = {
  id: string;
  campaign_id: string | null;
  referral_code: string | null;
  event_type: string;
  referred_user_id: string | null;
  country_code: string | null;
  created_at: string;
};

type RewardRow = {
  referred_user_id: string;
  reward_amount: number | null;
};

export function isAllowedReferralChannel(input: string): input is ReferralShareChannel {
  return (REFERRAL_SHARE_CHANNELS as readonly string[]).includes(input);
}

function cleanOptionalText(value: string | null | undefined, max = 120): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function normalizeLandingPath(input: string | null | undefined): string {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  if (raw.includes("\n") || raw.includes("\r")) return "/";
  return raw.slice(0, 200);
}

export function buildReferralCampaignShareLink(input: {
  siteUrl: string;
  referralCode: string;
  campaignId: string;
  landingPath?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
}): string {
  const base = input.siteUrl.replace(/\/$/, "");
  const url = new URL(`/r/${encodeURIComponent(input.referralCode)}`, `${base}/`);
  url.searchParams.set("c", input.campaignId);
  const landingPath = normalizeLandingPath(input.landingPath ?? "/");
  if (landingPath !== "/auth/register" && landingPath !== "/") {
    url.searchParams.set("next", landingPath);
  }

  if (cleanOptionalText(input.utmSource, 120)) {
    url.searchParams.set("utm_source", cleanOptionalText(input.utmSource, 120) || "");
  }
  if (cleanOptionalText(input.utmMedium, 120)) {
    url.searchParams.set("utm_medium", cleanOptionalText(input.utmMedium, 120) || "");
  }
  if (cleanOptionalText(input.utmCampaign, 120)) {
    url.searchParams.set("utm_campaign", cleanOptionalText(input.utmCampaign, 120) || "");
  }
  if (cleanOptionalText(input.utmContent, 120)) {
    url.searchParams.set("utm_content", cleanOptionalText(input.utmContent, 120) || "");
  }

  return url.toString();
}

export function createAnonId() {
  return randomUUID();
}

export function hashIpAddress(ip: string | null | undefined, salt = process.env.REFERRAL_IP_HASH_SALT || "") {
  const normalized = typeof ip === "string" ? ip.trim() : "";
  if (!normalized) return null;
  return createHash("sha256").update(`${normalized}:${salt}`).digest("hex");
}

export async function getReferralTrackingSettings(client: SupabaseClient): Promise<ReferralTrackingSettings> {
  const { data } = await client
    .from("app_settings")
    .select("key, value")
    .in("key", [
      APP_SETTING_KEYS.enableShareTracking,
      APP_SETTING_KEYS.attributionWindowDays,
      APP_SETTING_KEYS.storeIpHash,
    ]);

  const map = new Map<string, unknown>();
  for (const row of ((data as AppSettingRow[] | null) ?? [])) {
    map.set(row.key, row.value);
  }

  return {
    enabled: parseAppSettingBool(map.get(APP_SETTING_KEYS.enableShareTracking), true),
    attributionWindowDays: Math.max(
      1,
      Math.min(365, parseAppSettingInt(map.get(APP_SETTING_KEYS.attributionWindowDays), 30))
    ),
    storeIpHash: parseAppSettingBool(map.get(APP_SETTING_KEYS.storeIpHash), false),
  };
}

export function normalizeCampaignInput(input: ReferralCampaignInput): {
  ok: true;
  value: {
    name: string;
    channel: ReferralShareChannel;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
    landing_path: string;
  };
} | { ok: false; error: string } {
  const name = String(input.name || "").trim();
  if (name.length < 1 || name.length > 120) {
    return { ok: false, error: "Campaign name must be between 1 and 120 characters." };
  }

  const channel = String(input.channel || "").trim().toLowerCase();
  if (!isAllowedReferralChannel(channel)) {
    return { ok: false, error: "Invalid channel." };
  }

  return {
    ok: true,
    value: {
      name,
      channel,
      utm_source: cleanOptionalText(input.utm_source, 120),
      utm_medium: cleanOptionalText(input.utm_medium, 120),
      utm_campaign: cleanOptionalText(input.utm_campaign, 120),
      utm_content: cleanOptionalText(input.utm_content, 120),
      landing_path: normalizeLandingPath(input.landing_path),
    },
  };
}

export async function resolveCampaignIfValid(input: {
  client: SupabaseClient;
  campaignId: string | null;
  referralCode: string;
}): Promise<ReferralCampaignRecord | null> {
  const campaignId = (input.campaignId || "").trim();
  if (!campaignId) return null;

  const { data } = await input.client
    .from("referral_share_campaigns")
    .select(
      "id, owner_id, referral_code, name, channel, utm_source, utm_medium, utm_campaign, utm_content, landing_path, is_active, created_at, updated_at"
    )
    .eq("id", campaignId)
    .eq("referral_code", input.referralCode)
    .eq("is_active", true)
    .maybeSingle<ReferralCampaignRecord>();

  return data ?? null;
}

export async function insertReferralTouchEvent(
  client: SupabaseClient,
  input: ReferralTouchEventInput
): Promise<{ id: string } | null> {
  const { data } = await client
    .from("referral_touch_events")
    .insert({
      campaign_id: input.campaignId ?? null,
      referral_code: input.referralCode ?? null,
      event_type: input.eventType,
      anon_id: cleanOptionalText(input.anonId, 120),
      viewer_user_id: input.viewerUserId ?? null,
      referred_user_id: input.referredUserId ?? null,
      user_agent: cleanOptionalText(input.userAgent, 400),
      ip_hash: cleanOptionalText(input.ipHash, 128),
      country_code: cleanOptionalText(input.countryCode, 8),
      city: cleanOptionalText(input.city, 120),
      referrer_url: cleanOptionalText(input.referrerUrl, 500),
      landing_url: cleanOptionalText(input.landingUrl, 500),
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  return data ?? null;
}

export async function upsertReferralAttribution(input: {
  client: SupabaseClient;
  campaignId: string | null;
  referralCode: string;
  referredUserId: string;
  referrerOwnerId: string;
  firstTouchEventId?: string | null;
  capturedEventId?: string | null;
}): Promise<AttributionRow | null> {
  const now = new Date().toISOString();
  const { data } = await input.client
    .from("referral_attributions")
    .upsert(
      {
        campaign_id: input.campaignId,
        referral_code: input.referralCode,
        referred_user_id: input.referredUserId,
        referrer_owner_id: input.referrerOwnerId,
        first_touch_event_id: input.firstTouchEventId ?? null,
        captured_event_id: input.capturedEventId ?? null,
        created_at: now,
      },
      { onConflict: "referred_user_id" }
    )
    .select(
      "id, campaign_id, referral_code, referred_user_id, referrer_owner_id, first_touch_event_id, captured_event_id, created_at"
    )
    .maybeSingle<AttributionRow>();

  return data ?? null;
}

function computeCampaignMetrics(input: {
  campaign: ReferralCampaignRecord;
  touchEvents: TouchRow[];
  attributions: AttributionRow[];
  rewardsByReferred: Map<string, number>;
}): ReferralCampaignMetrics {
  const now = Date.now();
  const since30d = now - 30 * 24 * 60 * 60 * 1000;

  const campaignTouches = input.touchEvents.filter((event) => event.campaign_id === input.campaign.id);
  const clicks = campaignTouches.filter((event) => event.event_type === "click").length;
  const clicks30d = campaignTouches.filter((event) => {
    if (event.event_type !== "click") return false;
    const ts = new Date(event.created_at).getTime();
    return Number.isFinite(ts) && ts >= since30d;
  }).length;

  const campaignAttributions = input.attributions.filter(
    (attr) => attr.campaign_id === input.campaign.id
  );
  const captures = campaignAttributions.length;

  let activeReferrals = 0;
  let earningsCredits = 0;
  for (const attribution of campaignAttributions) {
    const reward = input.rewardsByReferred.get(attribution.referred_user_id) ?? 0;
    if (reward > 0) {
      activeReferrals += 1;
      earningsCredits += reward;
    }
  }

  return {
    campaignId: input.campaign.id,
    clicks,
    clicks30d,
    captures,
    activeReferrals,
    earningsCredits: Number(earningsCredits.toFixed(2)),
    conversionRate: clicks > 0 ? Number(((captures / clicks) * 100).toFixed(2)) : 0,
  };
}

export async function getReferralOwnerAnalytics(input: {
  client: SupabaseClient;
  ownerId: string;
}): Promise<ReferralOwnerAnalytics> {
  const [siteUrl, campaignsResult, touchResult, attributionResult, rewardsResult] = await Promise.all([
    getSiteUrl(),
    input.client
      .from("referral_share_campaigns")
      .select(
        "id, owner_id, referral_code, name, channel, utm_source, utm_medium, utm_campaign, utm_content, landing_path, is_active, created_at, updated_at"
      )
      .eq("owner_id", input.ownerId)
      .order("created_at", { ascending: false }),
    input.client
      .from("referral_touch_events")
      .select("id, campaign_id, referral_code, event_type, referred_user_id, country_code, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    input.client
      .from("referral_attributions")
      .select("id, campaign_id, referral_code, referred_user_id, referrer_owner_id, first_touch_event_id, captured_event_id, created_at")
      .eq("referrer_owner_id", input.ownerId)
      .order("created_at", { ascending: false }),
    input.client
      .from("referral_rewards")
      .select("referred_user_id, reward_amount")
      .eq("referrer_user_id", input.ownerId),
  ]);

  const campaigns = (campaignsResult.data as ReferralCampaignRecord[] | null) ?? [];
  const campaignIds = new Set(campaigns.map((campaign) => campaign.id));

  const touchEvents = (((touchResult.data as TouchRow[] | null) ?? []).filter((event) =>
    event.campaign_id ? campaignIds.has(event.campaign_id) : false
  ));

  const attributions = (attributionResult.data as AttributionRow[] | null) ?? [];
  const rewardRows = (rewardsResult.data as RewardRow[] | null) ?? [];

  const rewardsByReferred = new Map<string, number>();
  for (const row of rewardRows) {
    const key = String(row.referred_user_id || "");
    if (!key) continue;
    rewardsByReferred.set(key, (rewardsByReferred.get(key) ?? 0) + Math.max(0, Number(row.reward_amount || 0)));
  }

  const campaignsWithMetrics = campaigns.map((campaign) => {
    const metrics = computeCampaignMetrics({
      campaign,
      touchEvents,
      attributions,
      rewardsByReferred,
    });

    return {
      ...campaign,
      ...metrics,
      shareLink: buildReferralCampaignShareLink({
        siteUrl,
        referralCode: campaign.referral_code,
        campaignId: campaign.id,
        landingPath: campaign.landing_path,
        utmSource: campaign.utm_source,
        utmMedium: campaign.utm_medium,
        utmCampaign: campaign.utm_campaign,
        utmContent: campaign.utm_content,
      }),
    };
  });

  const totals = campaignsWithMetrics.reduce(
    (acc, campaign) => {
      acc.clicks += campaign.clicks;
      acc.captures += campaign.captures;
      acc.activeReferrals += campaign.activeReferrals;
      acc.earningsCredits += campaign.earningsCredits;
      return acc;
    },
    { clicks: 0, captures: 0, activeReferrals: 0, earningsCredits: 0 }
  );

  return {
    totals: {
      ...totals,
      earningsCredits: Number(totals.earningsCredits.toFixed(2)),
    },
    campaigns: campaignsWithMetrics.sort((a, b) => {
      if (b.captures !== a.captures) return b.captures - a.captures;
      if (b.clicks !== a.clicks) return b.clicks - a.clicks;
      return String(b.created_at).localeCompare(String(a.created_at));
    }),
  };
}

export function maskPersonName(input: string | null | undefined, userId: string): string {
  const raw = String(input || "").trim().replace(/\s+/g, " ");
  if (!raw) return `Agent ${userId.slice(0, 6)}`;
  const parts = raw.split(" ").filter(Boolean);
  if (parts.length <= 1) {
    const initial = (parts[0] || raw || "A").charAt(0).toUpperCase();
    return `${initial}.`;
  }
  return `${parts[0]?.charAt(0).toUpperCase() || "A"}. ${parts[parts.length - 1] || ""}`;
}

export const REFERRAL_INVITE_STATUSES = [
  "draft",
  "sent",
  "reminded",
  "converted",
  "closed",
] as const;

export type ReferralInviteStatus = (typeof REFERRAL_INVITE_STATUSES)[number];

export type ReferralInviteInput = {
  invitee_name: string;
  invitee_contact?: string | null;
  campaign_id?: string | null;
  status?: string;
  reminder_at?: string | null;
  notes?: string | null;
};

export type ReferralCampaignDetail = {
  campaign: ReferralCampaignRecord & { shareLink: string };
  metrics: {
    clicks30d: number;
    clicksAllTime: number;
    captures: number;
    activeReferrals: number;
    paidEvents: number;
    earningsCredits: number;
    conversionRate: number;
  };
  timeline: Array<{ period: string; clicks: number; captures: number }>;
  byCountry: Array<{ countryCode: string; clicks: number }>;
  convertedUsers: Array<{
    userId: string;
    displayName: string;
    status: "captured" | "active" | "paid_event";
    date: string;
  }>;
};

export function isUuidLike(value: string | null | undefined): boolean {
  const raw = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
}

export function getClientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  return null;
}

export function normalizeReferralInviteInput(
  input: ReferralInviteInput
): { ok: true; value: Required<Omit<ReferralInviteInput, "status">> & { status: ReferralInviteStatus } } | { ok: false; error: string } {
  const invitee_name = String(input.invitee_name || "").trim();
  if (!invitee_name || invitee_name.length > 120) {
    return { ok: false, error: "Invitee name is required and must be at most 120 characters." };
  }
  const statusRaw = String(input.status || "draft").trim().toLowerCase();
  const status = (REFERRAL_INVITE_STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as ReferralInviteStatus)
    : null;
  if (!status) {
    return { ok: false, error: "Invalid invite status." };
  }

  const campaignIdRaw = String(input.campaign_id || "").trim();
  const campaign_id = campaignIdRaw && isUuidLike(campaignIdRaw) ? campaignIdRaw : null;
  if (campaignIdRaw && !campaign_id) {
    return { ok: false, error: "Invalid campaign id." };
  }

  const reminderRaw = String(input.reminder_at || "").trim();
  const reminderDate = reminderRaw ? new Date(reminderRaw) : null;
  const reminder_at =
    reminderDate && Number.isFinite(reminderDate.getTime()) ? reminderDate.toISOString() : null;
  if (reminderRaw && !reminder_at) {
    return { ok: false, error: "Invalid reminder date." };
  }

  return {
    ok: true,
    value: {
      invitee_name,
      invitee_contact: cleanOptionalText(input.invitee_contact, 180),
      campaign_id,
      status,
      reminder_at,
      notes: cleanOptionalText(input.notes, 500),
    },
  };
}

export async function getReferralCodeForOwner(
  client: SupabaseClient,
  ownerId: string
): Promise<string | null> {
  const { data } = await client
    .from("referral_codes")
    .select("code")
    .eq("user_id", ownerId)
    .maybeSingle<{ code: string | null }>();
  return data?.code ? String(data.code).trim().toUpperCase() : null;
}

export async function getReferralCodeOwner(
  client: SupabaseClient,
  referralCode: string
): Promise<string | null> {
  const code = String(referralCode || "").trim().toUpperCase();
  if (!code) return null;
  const { data } = await client
    .from("referral_codes")
    .select("user_id")
    .eq("code", code)
    .maybeSingle<{ user_id: string | null }>();
  return data?.user_id ? String(data.user_id) : null;
}

export async function findMostRecentTouchEventId(input: {
  client: SupabaseClient;
  campaignId?: string | null;
  referralCode: string;
  anonId?: string | null;
  eventType?: "click" | "captured" | "signup" | "paid_event";
}): Promise<string | null> {
  const query = input.client
    .from("referral_touch_events")
    .select("id, created_at")
    .eq("referral_code", String(input.referralCode || "").trim().toUpperCase())
    .order("created_at", { ascending: false })
    .limit(1);

  if (input.campaignId) {
    query.eq("campaign_id", input.campaignId);
  }
  if (input.anonId) {
    query.eq("anon_id", input.anonId);
  }
  if (input.eventType) {
    query.eq("event_type", input.eventType);
  }

  const { data } = await query.maybeSingle<{ id: string; created_at: string }>();
  return data?.id ?? null;
}

export async function logPaidEventForReferredUser(
  client: SupabaseClient,
  referredUserId: string
): Promise<void> {
  const userId = String(referredUserId || "").trim();
  if (!userId) return;
  const { data: attribution } = await client
    .from("referral_attributions")
    .select("campaign_id, referral_code")
    .eq("referred_user_id", userId)
    .maybeSingle<{ campaign_id: string | null; referral_code: string }>();

  if (!attribution?.referral_code) return;

  await insertReferralTouchEvent(client, {
    campaignId: attribution.campaign_id,
    referralCode: attribution.referral_code,
    eventType: "paid_event",
    referredUserId: userId,
  });
}

function monthBucket(inputIso: string): string {
  const date = new Date(inputIso);
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

export async function getReferralCampaignDetail(input: {
  client: SupabaseClient;
  ownerId: string;
  campaignId: string;
}): Promise<ReferralCampaignDetail | null> {
  const { data: campaign } = await input.client
    .from("referral_share_campaigns")
    .select(
      "id, owner_id, referral_code, name, channel, utm_source, utm_medium, utm_campaign, utm_content, landing_path, is_active, created_at, updated_at"
    )
    .eq("owner_id", input.ownerId)
    .eq("id", input.campaignId)
    .maybeSingle<ReferralCampaignRecord>();

  if (!campaign) return null;

  const [siteUrl, touchResult, attributionResult, rewardResult] = await Promise.all([
    getSiteUrl(),
    input.client
      .from("referral_touch_events")
      .select("id, campaign_id, referral_code, event_type, referred_user_id, country_code, created_at")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false })
      .limit(5000),
    input.client
      .from("referral_attributions")
      .select("id, campaign_id, referral_code, referred_user_id, referrer_owner_id, first_touch_event_id, captured_event_id, created_at")
      .eq("campaign_id", campaign.id)
      .eq("referrer_owner_id", input.ownerId)
      .order("created_at", { ascending: false }),
    input.client
      .from("referral_rewards")
      .select("referred_user_id, reward_amount, issued_at")
      .eq("referrer_user_id", input.ownerId),
  ]);

  const touches = (touchResult.data as TouchRow[] | null) ?? [];
  const attributions = (attributionResult.data as AttributionRow[] | null) ?? [];
  const rewards =
    ((rewardResult.data as Array<{ referred_user_id: string; reward_amount: number | null; issued_at: string }> | null) ?? []);

  const now = Date.now();
  const since30d = now - 30 * 24 * 60 * 60 * 1000;
  const clicks = touches.filter((event) => event.event_type === "click");
  const clicks30d = clicks.filter((event) => {
    const ts = new Date(event.created_at).getTime();
    return Number.isFinite(ts) && ts >= since30d;
  }).length;

  const rewardByUser = new Map<string, number>();
  for (const reward of rewards) {
    const userId = String(reward.referred_user_id || "");
    if (!userId) continue;
    rewardByUser.set(userId, (rewardByUser.get(userId) ?? 0) + Math.max(0, Number(reward.reward_amount || 0)));
  }

  const paidEventUsers = new Set(
    touches
      .filter((event) => event.event_type === "paid_event" && event.referred_user_id)
      .map((event) => String(event.referred_user_id))
  );

  const referredIds = Array.from(new Set(attributions.map((row) => row.referred_user_id)));
  const profileMap = new Map<string, string>();
  if (referredIds.length > 0) {
    const { data: profiles } = await input.client
      .from("profiles")
      .select("id, full_name")
      .in("id", referredIds);
    for (const profile of (((profiles as Array<{ id: string; full_name: string | null }> | null) ?? []))) {
      profileMap.set(profile.id, String(profile.full_name || ""));
    }
  }

  const convertedUsers = attributions.map((attr) => {
    const hasPaid = paidEventUsers.has(attr.referred_user_id);
    const rewardCredits = rewardByUser.get(attr.referred_user_id) ?? 0;
    const status: "captured" | "active" | "paid_event" = hasPaid
      ? "paid_event"
      : rewardCredits > 0
        ? "active"
        : "captured";
    return {
      userId: attr.referred_user_id,
      displayName: maskPersonName(profileMap.get(attr.referred_user_id), attr.referred_user_id),
      status,
      date: attr.created_at,
    };
  });

  const paidEvents = touches.filter((event) => event.event_type === "paid_event").length;
  const activeReferrals = attributions.filter((attr) => (rewardByUser.get(attr.referred_user_id) ?? 0) > 0).length;
  const earningsCredits = attributions.reduce(
    (sum, attr) => sum + (rewardByUser.get(attr.referred_user_id) ?? 0),
    0
  );
  const conversionRate = clicks.length ? Number(((attributions.length / clicks.length) * 100).toFixed(2)) : 0;

  const timelineByMonth = new Map<string, { period: string; clicks: number; captures: number }>();
  for (const click of clicks) {
    const key = monthBucket(click.created_at);
    if (!key) continue;
    const current = timelineByMonth.get(key) ?? { period: key, clicks: 0, captures: 0 };
    current.clicks += 1;
    timelineByMonth.set(key, current);
  }
  for (const capture of attributions) {
    const key = monthBucket(capture.created_at);
    if (!key) continue;
    const current = timelineByMonth.get(key) ?? { period: key, clicks: 0, captures: 0 };
    current.captures += 1;
    timelineByMonth.set(key, current);
  }
  const timeline = Array.from(timelineByMonth.values())
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-6);

  const countryMap = new Map<string, number>();
  for (const click of clicks) {
    const key = String(click.country_code || "Unknown").toUpperCase();
    countryMap.set(key, (countryMap.get(key) ?? 0) + 1);
  }
  const byCountry = Array.from(countryMap.entries())
    .map(([countryCode, clicksCount]) => ({ countryCode, clicks: clicksCount }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  return {
    campaign: {
      ...campaign,
      shareLink: buildReferralCampaignShareLink({
        siteUrl,
        referralCode: campaign.referral_code,
        campaignId: campaign.id,
        landingPath: campaign.landing_path,
        utmSource: campaign.utm_source,
        utmMedium: campaign.utm_medium,
        utmCampaign: campaign.utm_campaign,
        utmContent: campaign.utm_content,
      }),
    },
    metrics: {
      clicks30d,
      clicksAllTime: clicks.length,
      captures: attributions.length,
      activeReferrals,
      paidEvents,
      earningsCredits: Number(earningsCredits.toFixed(2)),
      conversionRate,
    },
    timeline,
    byCountry,
    convertedUsers: convertedUsers.sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export async function getAdminReferralAttributionOverview(input: {
  client: SupabaseClient;
  topLimit?: number;
}): Promise<{
  totals: { clicks: number; captures: number };
  capturesByChannel: Array<{ channel: string; captures: number }>;
  topCampaigns: Array<{
    campaignId: string;
    campaignName: string;
    ownerMask: string;
    channel: string;
    clicks: number;
    captures: number;
  }>;
}> {
  const topLimit = Math.max(1, Math.min(50, Math.trunc(input.topLimit ?? 20)));
  const [campaignsResult, touchResult, attributionResult] = await Promise.all([
    input.client
      .from("referral_share_campaigns")
      .select("id, owner_id, name, channel")
      .order("created_at", { ascending: false })
      .limit(5000),
    input.client
      .from("referral_touch_events")
      .select("campaign_id, event_type")
      .order("created_at", { ascending: false })
      .limit(10000),
    input.client
      .from("referral_attributions")
      .select("campaign_id")
      .order("created_at", { ascending: false })
      .limit(10000),
  ]);

  const campaigns =
    ((campaignsResult.data as Array<{ id: string; owner_id: string; name: string; channel: string }> | null) ?? []);
  const touches = ((touchResult.data as Array<{ campaign_id: string | null; event_type: string }> | null) ?? []);
  const attributions = ((attributionResult.data as Array<{ campaign_id: string | null }> | null) ?? []);

  const clickByCampaign = new Map<string, number>();
  for (const row of touches) {
    if (row.event_type !== "click" || !row.campaign_id) continue;
    clickByCampaign.set(row.campaign_id, (clickByCampaign.get(row.campaign_id) ?? 0) + 1);
  }
  const captureByCampaign = new Map<string, number>();
  for (const row of attributions) {
    if (!row.campaign_id) continue;
    captureByCampaign.set(row.campaign_id, (captureByCampaign.get(row.campaign_id) ?? 0) + 1);
  }

  const channelCaptures = new Map<string, number>();
  const topCampaigns = campaigns
    .map((campaign) => {
      const captures = captureByCampaign.get(campaign.id) ?? 0;
      channelCaptures.set(campaign.channel, (channelCaptures.get(campaign.channel) ?? 0) + captures);
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        ownerMask: `Agent ${campaign.owner_id.slice(0, 6)}`,
        channel: campaign.channel,
        clicks: clickByCampaign.get(campaign.id) ?? 0,
        captures,
      };
    })
    .sort((a, b) => {
      if (b.captures !== a.captures) return b.captures - a.captures;
      return b.clicks - a.clicks;
    })
    .slice(0, topLimit);

  return {
    totals: {
      clicks: Array.from(clickByCampaign.values()).reduce((sum, value) => sum + value, 0),
      captures: attributions.length,
    },
    capturesByChannel: Array.from(channelCaptures.entries())
      .map(([channel, captures]) => ({ channel, captures }))
      .sort((a, b) => b.captures - a.captures),
    topCampaigns,
  };
}
