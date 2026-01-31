import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

type AppSettingRow = { key: string; value: unknown };

export const CONTACT_EXCHANGE_MODES = ["off", "redact", "block"] as const;
export type ContactExchangeMode = (typeof CONTACT_EXCHANGE_MODES)[number];

export function parseAppSettingBool(value: unknown, defaultValue: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "object" && value !== null && "enabled" in value) {
    const enabled = (value as { enabled?: unknown }).enabled;
    if (typeof enabled === "boolean") return enabled;
  }
  return defaultValue;
}

export function parseContactExchangeMode(
  value: unknown,
  defaultValue: ContactExchangeMode
): ContactExchangeMode {
  if (typeof value === "string" && CONTACT_EXCHANGE_MODES.includes(value as ContactExchangeMode)) {
    return value as ContactExchangeMode;
  }
  if (typeof value === "object" && value !== null && "mode" in value) {
    const mode = (value as { mode?: unknown }).mode;
    if (typeof mode === "string" && CONTACT_EXCHANGE_MODES.includes(mode as ContactExchangeMode)) {
      return mode as ContactExchangeMode;
    }
  }
  return defaultValue;
}

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

export async function getContactExchangeMode(
  client?: SupabaseClient,
  defaultValue: ContactExchangeMode = "redact"
): Promise<ContactExchangeMode> {
  return getAppSettingMode("contact_exchange_mode", defaultValue, client);
}
