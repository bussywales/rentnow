import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getAppSettingBool, getAppSettingString } from "@/lib/settings/app-settings.server";
import { normalizeExploreV2CtaCopyVariant, type ExploreV2CtaCopyVariant } from "@/lib/explore/explore-presentation";

export async function isExploreEnabled(): Promise<boolean> {
  return getAppSettingBool(APP_SETTING_KEYS.exploreEnabled, true);
}

export async function isExploreV2TrustCueEnabled(): Promise<boolean> {
  return getAppSettingBool(APP_SETTING_KEYS.exploreV2TrustCueEnabled, false);
}

export async function getExploreV2CtaCopyVariant(): Promise<ExploreV2CtaCopyVariant> {
  const rawValue = await getAppSettingString(APP_SETTING_KEYS.exploreV2CtaCopyVariant, "default");
  return normalizeExploreV2CtaCopyVariant(rawValue);
}
