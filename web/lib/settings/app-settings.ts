import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

type AppSettingRow = { key: string; value: unknown };

export function parseAppSettingBool(value: unknown, defaultValue: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "object" && value !== null && "enabled" in value) {
    const enabled = (value as { enabled?: unknown }).enabled;
    if (typeof enabled === "boolean") return enabled;
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
