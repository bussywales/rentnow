import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";

export async function isExploreEnabled(): Promise<boolean> {
  return getAppSettingBool(APP_SETTING_KEYS.exploreEnabled, true);
}
