import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  parseAppSettingBool,
  parseAppSettingInt,
  parseAppSettingString,
  parseContactExchangeMode,
  type ContactExchangeMode,
} from "@/lib/settings/app-settings";

type AppSettingRow = { key: string; value: unknown };

export async function getAppSettingBool(key: string, defaultValue: boolean): Promise<boolean> {
  if (!hasServerSupabaseEnv()) return defaultValue;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("key", key)
      .maybeSingle<AppSettingRow>();
    if (error || !data) return defaultValue;
    return parseAppSettingBool(data.value, defaultValue);
  } catch {
    return defaultValue;
  }
}

export async function getAppSettingInt(key: string, defaultValue: number): Promise<number> {
  if (!hasServerSupabaseEnv()) return defaultValue;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("key", key)
      .maybeSingle<AppSettingRow>();
    if (error || !data) return defaultValue;
    return parseAppSettingInt(data.value, defaultValue);
  } catch {
    return defaultValue;
  }
}

export async function getAppSettingMode(
  key: string,
  defaultValue: ContactExchangeMode,
  client?: SupabaseClient
): Promise<ContactExchangeMode> {
  if (!hasServerSupabaseEnv()) return defaultValue;
  try {
    const supabase = client ?? (await createServerSupabaseClient());
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("key", key)
      .maybeSingle<AppSettingRow>();
    if (error || !data) return defaultValue;
    return parseContactExchangeMode(data.value, defaultValue);
  } catch {
    return defaultValue;
  }
}

export async function getAppSettingString(
  key: string,
  defaultValue: string,
  client?: SupabaseClient
): Promise<string> {
  if (!hasServerSupabaseEnv()) return defaultValue;
  try {
    const supabase = client ?? (await createServerSupabaseClient());
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("key", key)
      .maybeSingle<AppSettingRow>();
    if (error || !data) return defaultValue;
    return parseAppSettingString(data.value, defaultValue);
  } catch {
    return defaultValue;
  }
}

export async function getContactExchangeMode(
  client?: SupabaseClient,
  defaultValue: ContactExchangeMode = "redact"
): Promise<ContactExchangeMode> {
  return getAppSettingMode("contact_exchange_mode", defaultValue, client);
}
