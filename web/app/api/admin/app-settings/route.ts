import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { logAuditEvent } from "@/lib/audit/audit-log";
import {
  APP_SETTING_KEY_LIST,
  APP_SETTING_KEYS,
  type AppSettingKey,
} from "@/lib/settings/app-settings-keys";

const ALLOWED_KEYS = APP_SETTING_KEY_LIST as [AppSettingKey, ...AppSettingKey[]];
const routeLabel = "/api/admin/app-settings";

const enabledValueSchema = z.object({
  enabled: z.boolean(),
});

const modeValueSchema = z.object({
  mode: z.enum(["off", "redact", "block"]),
});

const daysValueSchema = z.object({
  days: z.number().int().min(7).max(365),
});
const attributionWindowDaysSchema = z.object({
  days: z.number().int().min(1).max(365),
});

const numericValueSchema = z.object({
  value: z.number().int().min(0).max(1_000_000),
});
const textValueSchema = z.object({
  value: z.string().trim().min(1).max(16),
});

const referralEnabledLevelsSchema = z.object({
  value: z.array(z.number().int().min(1).max(5)).min(1).max(5),
});

const referralRewardRulesSchema = z
  .object({
    value: z.record(
      z.string(),
      z.object({
        type: z.enum(["listing_credit", "featured_credit", "discount"]),
        amount: z.number().positive().max(1_000_000),
      })
    ),
  })
  .refine((payload) => Object.keys(payload.value).every((key) => /^[1-5]$/.test(key)), {
    message: "Invalid level key",
  });

const referralTierThresholdSchema = z
  .object({
    value: z.record(z.string().min(1), z.number().int().min(0).max(1_000_000)),
  })
  .refine((payload) => Object.keys(payload.value).length > 0, {
    message: "Tier thresholds required",
  });

const referralCapsSchema = z
  .object({
    value: z.object({
      daily: z.number().int().min(0).max(1_000_000),
      monthly: z.number().int().min(0).max(1_000_000),
    }),
  })
  .refine((payload) => payload.value.monthly >= payload.value.daily, {
    message: "Monthly cap must be >= daily cap",
  });

const leaderboardScopeSchema = z.object({
  scope: z.enum(["global", "by_country", "by_city"]),
});

const alertsLastRunStatusSchema = z.object({
  ran_at_utc: z.string().datetime().nullable(),
  mode: z.enum(["cron", "admin"]),
  users_processed: z.number().int().min(0),
  digests_sent: z.number().int().min(0),
  searches_included: z.number().int().min(0),
  failed_users: z.number().int().min(0),
  disabled_reason: z.enum(["kill_switch", "feature_flag_off"]).nullable(),
});

export const patchSchema = z.object({
  key: z.enum(ALLOWED_KEYS),
  value: z.union([
    enabledValueSchema,
    modeValueSchema,
    daysValueSchema,
    attributionWindowDaysSchema,
    numericValueSchema,
    textValueSchema,
    referralEnabledLevelsSchema,
    referralRewardRulesSchema,
    referralTierThresholdSchema,
    referralCapsSchema,
    leaderboardScopeSchema,
    alertsLastRunStatusSchema,
  ]),
});

export function validatePatchPayload(input: unknown) {
  const parsed = patchSchema.safeParse(input);
  if (parsed.success) {
    return { ok: true as const, data: parsed.data };
  }
  return { ok: false as const, error: parsed.error };
}

export function validateSettingValueByKey(key: AppSettingKey, value: unknown) {
  const isModeSetting = key === APP_SETTING_KEYS.contactExchangeMode;
  const isExpirySetting = key === APP_SETTING_KEYS.listingExpiryDays;
  const isNumericSetting =
    key === APP_SETTING_KEYS.paygListingFeeAmount ||
    key === APP_SETTING_KEYS.paygFeaturedFeeAmount ||
    key === APP_SETTING_KEYS.featuredDurationDays ||
    key === APP_SETTING_KEYS.trialListingCreditsAgent ||
    key === APP_SETTING_KEYS.trialListingCreditsLandlord ||
    key === APP_SETTING_KEYS.featuredPrice7dMinor ||
    key === APP_SETTING_KEYS.featuredPrice30dMinor;
  const isFeaturedReviewSla = key === APP_SETTING_KEYS.featuredReviewSlaDays;
  const isFeaturedMinPhotos = key === APP_SETTING_KEYS.featuredMinPhotos;
  const isFeaturedMinDescriptionChars = key === APP_SETTING_KEYS.featuredMinDescriptionChars;
  const isFeaturedCurrency = key === APP_SETTING_KEYS.featuredCurrency;
  const isFeaturedRequestsEnabled = key === APP_SETTING_KEYS.featuredRequestsEnabled;
  const isFeaturedRequiresApproved = key === APP_SETTING_KEYS.featuredRequiresApprovedListing;
  const isFeaturedRequiresActive = key === APP_SETTING_KEYS.featuredRequiresActiveListing;
  const isFeaturedRequiresNotDemo = key === APP_SETTING_KEYS.featuredRequiresNotDemo;
  const isReferralMaxDepth = key === APP_SETTING_KEYS.referralMaxDepth;
  const isReferralLevels = key === APP_SETTING_KEYS.referralEnabledLevels;
  const isReferralRules = key === APP_SETTING_KEYS.referralRewardRules;
  const isReferralTiers =
    key === APP_SETTING_KEYS.referralTierThresholds ||
    key === APP_SETTING_KEYS.referralsTierThresholds;
  const isReferralMilestonesEnabled = key === APP_SETTING_KEYS.referralsMilestonesEnabled;
  const isReferralLeaderboardEnabled = key === APP_SETTING_KEYS.referralsLeaderboardEnabled;
  const isReferralLeaderboardPublicVisible =
    key === APP_SETTING_KEYS.referralsLeaderboardPublicVisible;
  const isReferralLeaderboardMonthlyEnabled =
    key === APP_SETTING_KEYS.referralsLeaderboardMonthlyEnabled;
  const isReferralLeaderboardAllTimeEnabled =
    key === APP_SETTING_KEYS.referralsLeaderboardAllTimeEnabled;
  const isReferralLeaderboardInitialsOnly =
    key === APP_SETTING_KEYS.referralsLeaderboardInitialsOnly;
  const isReferralLeaderboardScope = key === APP_SETTING_KEYS.referralsLeaderboardScope;
  const isShareTrackingEnabled = key === APP_SETTING_KEYS.enableShareTracking;
  const isAttributionWindowDays = key === APP_SETTING_KEYS.attributionWindowDays;
  const isStoreIpHash = key === APP_SETTING_KEYS.storeIpHash;
  const isReferralCaps = key === APP_SETTING_KEYS.referralCaps;
  const isDefaultMarketCountry = key === APP_SETTING_KEYS.defaultMarketCountry;
  const isDefaultMarketCurrency = key === APP_SETTING_KEYS.defaultMarketCurrency;
  const isMarketAutoDetectEnabled = key === APP_SETTING_KEYS.marketAutoDetectEnabled;
  const isMarketSelectorEnabled = key === APP_SETTING_KEYS.marketSelectorEnabled;
  const isAlertsKillSwitchEnabled = key === APP_SETTING_KEYS.alertsKillSwitchEnabled;
  const isAlertsLastRunStatus = key === APP_SETTING_KEYS.alertsLastRunStatusJson;

  if (isModeSetting) return modeValueSchema.safeParse(value).success;
  if (isExpirySetting) return daysValueSchema.safeParse(value).success;
  if (isNumericSetting) return numericValueSchema.safeParse(value).success;
  if (isFeaturedReviewSla) {
    return numericValueSchema.extend({ value: z.number().int().min(1).max(30) }).safeParse(value)
      .success;
  }
  if (isFeaturedMinPhotos) {
    return numericValueSchema.extend({ value: z.number().int().min(0).max(20) }).safeParse(value)
      .success;
  }
  if (isFeaturedMinDescriptionChars) {
    return numericValueSchema.extend({ value: z.number().int().min(0).max(5000) }).safeParse(value)
      .success;
  }
  if (isFeaturedCurrency) {
    return textValueSchema
      .extend({ value: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/) })
      .safeParse(value).success;
  }
  if (isFeaturedRequestsEnabled) return enabledValueSchema.safeParse(value).success;
  if (isFeaturedRequiresApproved) return enabledValueSchema.safeParse(value).success;
  if (isFeaturedRequiresActive) return enabledValueSchema.safeParse(value).success;
  if (isFeaturedRequiresNotDemo) return enabledValueSchema.safeParse(value).success;
  if (isReferralMaxDepth) {
    return numericValueSchema.extend({ value: z.number().int().min(1).max(5) }).safeParse(value)
      .success;
  }
  if (isReferralLevels) return referralEnabledLevelsSchema.safeParse(value).success;
  if (isReferralRules) return referralRewardRulesSchema.safeParse(value).success;
  if (isReferralTiers) return referralTierThresholdSchema.safeParse(value).success;
  if (isReferralMilestonesEnabled) return enabledValueSchema.safeParse(value).success;
  if (isReferralLeaderboardEnabled) return enabledValueSchema.safeParse(value).success;
  if (isReferralLeaderboardPublicVisible) return enabledValueSchema.safeParse(value).success;
  if (isReferralLeaderboardMonthlyEnabled) return enabledValueSchema.safeParse(value).success;
  if (isReferralLeaderboardAllTimeEnabled) return enabledValueSchema.safeParse(value).success;
  if (isReferralLeaderboardInitialsOnly) return enabledValueSchema.safeParse(value).success;
  if (isReferralLeaderboardScope) return leaderboardScopeSchema.safeParse(value).success;
  if (isShareTrackingEnabled) return enabledValueSchema.safeParse(value).success;
  if (isAttributionWindowDays) {
    return attributionWindowDaysSchema.safeParse(value).success;
  }
  if (isStoreIpHash) return enabledValueSchema.safeParse(value).success;
  if (isReferralCaps) return referralCapsSchema.safeParse(value).success;
  if (isDefaultMarketCountry) {
    return textValueSchema
      .extend({ value: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/) })
      .safeParse(value).success;
  }
  if (isDefaultMarketCurrency) {
    return textValueSchema
      .extend({ value: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/) })
      .safeParse(value).success;
  }
  if (isMarketAutoDetectEnabled) return enabledValueSchema.safeParse(value).success;
  if (isMarketSelectorEnabled) return enabledValueSchema.safeParse(value).success;
  if (isAlertsKillSwitchEnabled) return enabledValueSchema.safeParse(value).success;
  if (isAlertsLastRunStatus) return alertsLastRunStatusSchema.safeParse(value).success;
  return enabledValueSchema.safeParse(value).success;
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key || !ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number])) {
    return NextResponse.json({ error: "Unsupported key" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value, updated_at")
    .eq("key", key)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Setting not found" }, { status: 404 });
  return NextResponse.json({ ok: true, setting: data });
}

export async function PATCH(request: Request) {
  const startTime = Date.now();
  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const parsed = validatePatchPayload(await request.json());
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid setting payload" }, { status: 400 });
  }
  const body = parsed.data;
  if (!validateSettingValueByKey(body.key, body.value)) {
    return NextResponse.json({ error: "Invalid setting payload" }, { status: 400 });
  }
  const adminClient = createServiceRoleClient() as unknown as UntypedAdminClient;
  const now = new Date().toISOString();
  const { data, error } = await adminClient
    .from("app_settings")
    .upsert({ key: body.key, value: body.value, updated_at: now }, { onConflict: "key" })
    .select("key, value, updated_at")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  logAuditEvent("app_setting_updated", {
    route: routeLabel,
    actorId: auth.user.id,
    outcome: "ok",
    meta: {
      key: body.key,
      value: JSON.stringify(body.value),
    },
  });

  return NextResponse.json({ ok: true, setting: data });
}
