import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  FEATURED_ELIGIBILITY_SETTING_KEYS,
  DEFAULT_FEATURED_ELIGIBILITY_SETTINGS,
  parseFeaturedEligibilitySettings,
  type FeaturedEligibilitySettings,
} from "@/lib/featured/eligibility";

type AppSettingRow = {
  key: string;
  value: unknown;
};

export async function getFeaturedEligibilitySettings(
  client?: SupabaseClient
): Promise<FeaturedEligibilitySettings> {
  if (!hasServerSupabaseEnv()) return DEFAULT_FEATURED_ELIGIBILITY_SETTINGS;
  try {
    const supabase = client ?? (await createServerSupabaseClient());
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [...FEATURED_ELIGIBILITY_SETTING_KEYS]);
    if (error || !data) return DEFAULT_FEATURED_ELIGIBILITY_SETTINGS;
    return parseFeaturedEligibilitySettings(data as AppSettingRow[]);
  } catch {
    return DEFAULT_FEATURED_ELIGIBILITY_SETTINGS;
  }
}
