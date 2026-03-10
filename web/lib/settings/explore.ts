import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";

export async function isExploreEnabled(): Promise<boolean> {
  return getAppSettingBool(APP_SETTING_KEYS.exploreEnabled, true);
}

export async function isExploreV2TrustCueEnabled(): Promise<boolean> {
  return getAppSettingBool(APP_SETTING_KEYS.exploreV2TrustCueEnabled, false);
}
