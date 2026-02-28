import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAppSettingBool } from "@/lib/settings/app-settings";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";

type AppSettingRow = {
  key: string;
  value: unknown;
};

export type ExploreAnalyticsSettings = {
  enabled: boolean;
  consentRequired: boolean;
  noticeEnabled: boolean;
};

export const DEFAULT_EXPLORE_ANALYTICS_SETTINGS: ExploreAnalyticsSettings = {
  enabled: true,
  consentRequired: false,
  noticeEnabled: true,
};

export function parseExploreAnalyticsSettingsRows(
  rows: ReadonlyArray<AppSettingRow> | null | undefined
): ExploreAnalyticsSettings {
  const safeRows = rows ?? [];
  const enabledRow = safeRows.find((row) => row.key === APP_SETTING_KEYS.exploreAnalyticsEnabled);
  const consentRequiredRow = safeRows.find(
    (row) => row.key === APP_SETTING_KEYS.exploreAnalyticsConsentRequired
  );
  const noticeEnabledRow = safeRows.find(
    (row) => row.key === APP_SETTING_KEYS.exploreAnalyticsNoticeEnabled
  );

  return {
    enabled: parseAppSettingBool(enabledRow?.value, DEFAULT_EXPLORE_ANALYTICS_SETTINGS.enabled),
    consentRequired: parseAppSettingBool(
      consentRequiredRow?.value,
      DEFAULT_EXPLORE_ANALYTICS_SETTINGS.consentRequired
    ),
    noticeEnabled: parseAppSettingBool(
      noticeEnabledRow?.value,
      DEFAULT_EXPLORE_ANALYTICS_SETTINGS.noticeEnabled
    ),
  };
}

export async function getExploreAnalyticsSettings(
  supabase: SupabaseClient
): Promise<ExploreAnalyticsSettings> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", [
      APP_SETTING_KEYS.exploreAnalyticsEnabled,
      APP_SETTING_KEYS.exploreAnalyticsConsentRequired,
      APP_SETTING_KEYS.exploreAnalyticsNoticeEnabled,
    ]);

  if (error) return DEFAULT_EXPLORE_ANALYTICS_SETTINGS;
  return parseExploreAnalyticsSettingsRows((data as AppSettingRow[] | null) ?? []);
}
