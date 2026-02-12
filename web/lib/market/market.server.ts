import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { parseAppSettingBool, parseAppSettingString } from "@/lib/settings/app-settings";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { DEFAULT_MARKET_SETTINGS, type MarketSettings } from "@/lib/market/market";

type AppSettingRow = {
  key: string;
  value: unknown;
};

const MARKET_SETTING_KEYS = [
  APP_SETTING_KEYS.defaultMarketCountry,
  APP_SETTING_KEYS.defaultMarketCurrency,
  APP_SETTING_KEYS.marketAutoDetectEnabled,
  APP_SETTING_KEYS.marketSelectorEnabled,
] as const;

export async function getMarketSettings(client?: SupabaseClient): Promise<MarketSettings> {
  if (!hasServerSupabaseEnv()) return DEFAULT_MARKET_SETTINGS;
  try {
    const supabase = client ?? (await createServerSupabaseClient());
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [...MARKET_SETTING_KEYS]);
    if (error) return DEFAULT_MARKET_SETTINGS;
    const rows = (data as AppSettingRow[] | null) ?? [];
    const rowMap = new Map(rows.map((row) => [row.key, row.value]));
    return {
      defaultCountry: parseAppSettingString(
        rowMap.get(APP_SETTING_KEYS.defaultMarketCountry),
        DEFAULT_MARKET_SETTINGS.defaultCountry
      ).toUpperCase(),
      defaultCurrency: parseAppSettingString(
        rowMap.get(APP_SETTING_KEYS.defaultMarketCurrency),
        DEFAULT_MARKET_SETTINGS.defaultCurrency
      ).toUpperCase(),
      autoDetectEnabled: parseAppSettingBool(
        rowMap.get(APP_SETTING_KEYS.marketAutoDetectEnabled),
        DEFAULT_MARKET_SETTINGS.autoDetectEnabled
      ),
      selectorEnabled: parseAppSettingBool(
        rowMap.get(APP_SETTING_KEYS.marketSelectorEnabled),
        DEFAULT_MARKET_SETTINGS.selectorEnabled
      ),
    };
  } catch {
    return DEFAULT_MARKET_SETTINGS;
  }
}

