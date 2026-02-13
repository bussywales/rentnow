import { parseAppSettingBool, parseAppSettingString } from "@/lib/settings/app-settings";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { DEFAULT_FEATURED_ELIGIBILITY_SETTINGS } from "@/lib/featured/eligibility";
import { DEFAULT_MARKET_SETTINGS } from "@/lib/market/market";
import { DEFAULT_VERIFICATION_REQUIREMENTS } from "@/lib/trust-markers";

type AppSettingRow = {
  key: string;
  value: unknown;
};

type EnvSource = Record<string, string | undefined>;

export const SYSTEM_HEALTH_SETTING_KEYS = [
  APP_SETTING_KEYS.alertsEmailEnabled,
  APP_SETTING_KEYS.alertsKillSwitchEnabled,
  APP_SETTING_KEYS.featuredRequestsEnabled,
  APP_SETTING_KEYS.featuredListingsEnabled,
  APP_SETTING_KEYS.verificationRequireEmail,
  APP_SETTING_KEYS.verificationRequirePhone,
  APP_SETTING_KEYS.verificationRequireBank,
  APP_SETTING_KEYS.defaultMarketCountry,
  APP_SETTING_KEYS.defaultMarketCurrency,
  APP_SETTING_KEYS.marketAutoDetectEnabled,
  APP_SETTING_KEYS.marketSelectorEnabled,
] as const;

export type SystemHealthSettingsSnapshot = {
  alertsEmailEnabled: boolean;
  alertsKillSwitchEnabled: boolean;
  featuredRequestsEnabled: boolean;
  featuredListingsEnabled: boolean;
  verificationRequireEmail: boolean;
  verificationRequirePhone: boolean;
  verificationRequireBank: boolean;
  defaultMarketCountry: string;
  defaultMarketCurrency: string;
  marketAutoDetectEnabled: boolean;
  marketSelectorEnabled: boolean;
};

export type SystemHealthEnvStatus = {
  resendApiKeyPresent: boolean;
  cronSecretPresent: boolean;
  paystackSecretKeyPresent: boolean;
  commitSha: string | null;
};

function rowValue(rows: AppSettingRow[], key: string): unknown {
  return rows.find((row) => row.key === key)?.value;
}

export function getSystemHealthEnvStatus(env: EnvSource = process.env) {
  const commitShaRaw =
    env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    env.VERCEL_GIT_COMMIT_SHA ||
    env.COMMIT_SHA ||
    "";
  const commitSha = String(commitShaRaw || "").trim() || null;
  return {
    resendApiKeyPresent: Boolean(String(env.RESEND_API_KEY || "").trim()),
    cronSecretPresent: Boolean(String(env.CRON_SECRET || "").trim()),
    paystackSecretKeyPresent: Boolean(String(env.PAYSTACK_SECRET_KEY || "").trim()),
    commitSha,
  } satisfies SystemHealthEnvStatus;
}

export function buildSystemHealthSettingsSnapshot(rows: AppSettingRow[]) {
  return {
    alertsEmailEnabled: parseAppSettingBool(
      rowValue(rows, APP_SETTING_KEYS.alertsEmailEnabled),
      false
    ),
    alertsKillSwitchEnabled: parseAppSettingBool(
      rowValue(rows, APP_SETTING_KEYS.alertsKillSwitchEnabled),
      false
    ),
    featuredRequestsEnabled: parseAppSettingBool(
      rowValue(rows, APP_SETTING_KEYS.featuredRequestsEnabled),
      DEFAULT_FEATURED_ELIGIBILITY_SETTINGS.requestsEnabled
    ),
    featuredListingsEnabled: parseAppSettingBool(
      rowValue(rows, APP_SETTING_KEYS.featuredListingsEnabled),
      true
    ),
    verificationRequireEmail: parseAppSettingBool(
      rowValue(rows, APP_SETTING_KEYS.verificationRequireEmail),
      DEFAULT_VERIFICATION_REQUIREMENTS.requireEmail
    ),
    verificationRequirePhone: parseAppSettingBool(
      rowValue(rows, APP_SETTING_KEYS.verificationRequirePhone),
      DEFAULT_VERIFICATION_REQUIREMENTS.requirePhone
    ),
    verificationRequireBank: parseAppSettingBool(
      rowValue(rows, APP_SETTING_KEYS.verificationRequireBank),
      DEFAULT_VERIFICATION_REQUIREMENTS.requireBank
    ),
    defaultMarketCountry: parseAppSettingString(
      rowValue(rows, APP_SETTING_KEYS.defaultMarketCountry),
      DEFAULT_MARKET_SETTINGS.defaultCountry
    ).toUpperCase(),
    defaultMarketCurrency: parseAppSettingString(
      rowValue(rows, APP_SETTING_KEYS.defaultMarketCurrency),
      DEFAULT_MARKET_SETTINGS.defaultCurrency
    ).toUpperCase(),
    marketAutoDetectEnabled: parseAppSettingBool(
      rowValue(rows, APP_SETTING_KEYS.marketAutoDetectEnabled),
      DEFAULT_MARKET_SETTINGS.autoDetectEnabled
    ),
    marketSelectorEnabled: parseAppSettingBool(
      rowValue(rows, APP_SETTING_KEYS.marketSelectorEnabled),
      DEFAULT_MARKET_SETTINGS.selectorEnabled
    ),
  } satisfies SystemHealthSettingsSnapshot;
}
