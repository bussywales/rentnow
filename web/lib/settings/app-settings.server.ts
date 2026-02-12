import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  DEFAULT_ALERTS_LAST_RUN_STATUS,
  parseAlertsLastRunStatus,
  parseAppSettingBool,
  parseAppSettingInt,
  parseAppSettingString,
  parseContactExchangeMode,
  type AlertsLastRunStatus,
  type ContactExchangeMode,
} from "@/lib/settings/app-settings";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import {
  parseVerificationRequirements,
  VERIFICATION_REQUIREMENT_KEYS,
} from "@/lib/settings/verification-requirements";
import {
  DEFAULT_VERIFICATION_REQUIREMENTS,
  type VerificationRequirements,
} from "@/lib/trust-markers";

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

export async function getVerificationRequirements(
  client?: SupabaseClient
): Promise<VerificationRequirements> {
  if (!hasServerSupabaseEnv()) return DEFAULT_VERIFICATION_REQUIREMENTS;
  try {
    const supabase = client ?? (await createServerSupabaseClient());
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [...VERIFICATION_REQUIREMENT_KEYS]);
    if (error || !data) return DEFAULT_VERIFICATION_REQUIREMENTS;
    return parseVerificationRequirements(data as AppSettingRow[]);
  } catch {
    return DEFAULT_VERIFICATION_REQUIREMENTS;
  }
}

export async function getAlertsLastRunStatus(
  client?: SupabaseClient
): Promise<AlertsLastRunStatus> {
  if (!hasServerSupabaseEnv()) return DEFAULT_ALERTS_LAST_RUN_STATUS;
  try {
    const supabase = client ?? (await createServerSupabaseClient());
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("key", APP_SETTING_KEYS.alertsLastRunStatusJson)
      .maybeSingle<AppSettingRow>();
    if (error || !data) return DEFAULT_ALERTS_LAST_RUN_STATUS;
    return parseAlertsLastRunStatus(data.value);
  } catch {
    return DEFAULT_ALERTS_LAST_RUN_STATUS;
  }
}
