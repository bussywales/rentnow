import type { SupabaseClient } from "@supabase/supabase-js";
import { parseAppSettingString } from "@/lib/settings/app-settings";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

export type BrandSocialPlatform =
  | "instagram"
  | "youtube"
  | "tiktok"
  | "facebook"
  | "whatsapp";

export type BrandSocialLink = {
  platform: BrandSocialPlatform;
  label: string;
  href: string;
};

type AppSettingRow = {
  key: string;
  value: unknown;
};

const SOCIAL_SETTING_KEYS = {
  instagram: APP_SETTING_KEYS.brandSocialInstagramUrl,
  youtube: APP_SETTING_KEYS.brandSocialYoutubeUrl,
  tiktok: APP_SETTING_KEYS.brandSocialTiktokUrl,
  facebook: APP_SETTING_KEYS.brandSocialFacebookUrl,
  whatsapp: APP_SETTING_KEYS.brandSocialWhatsappLink,
} as const;

const SOCIAL_LABELS: Record<BrandSocialPlatform, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
};

type BrandSocialSettingsInput = Partial<Record<BrandSocialPlatform, string>>;

function normalizeHttpUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeWhatsappLink(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.includes("wa.me/") || /^https?:\/\//i.test(trimmed)) {
    return normalizeHttpUrl(trimmed);
  }
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}`;
}

export function resolveBrandSocialLinks(
  input: BrandSocialSettingsInput
): BrandSocialLink[] {
  const platforms: BrandSocialPlatform[] = [
    "instagram",
    "youtube",
    "tiktok",
    "facebook",
    "whatsapp",
  ];

  const links: BrandSocialLink[] = [];
  for (const platform of platforms) {
    const rawValue = input[platform] ?? "";
    const href =
      platform === "whatsapp"
        ? normalizeWhatsappLink(rawValue)
        : normalizeHttpUrl(rawValue);
    if (!href) continue;
    links.push({
      platform,
      label: SOCIAL_LABELS[platform],
      href,
    });
  }
  return links;
}

export async function getEnabledBrandSocialLinks(
  client?: SupabaseClient
): Promise<BrandSocialLink[]> {
  if (!hasServerSupabaseEnv()) return [];
  try {
    const supabase = client ?? (await createServerSupabaseClient());
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", Object.values(SOCIAL_SETTING_KEYS));
    if (error || !data) return [];

    const rows = data as AppSettingRow[];
    const settingsInput: BrandSocialSettingsInput = {
      instagram: parseAppSettingString(
        rows.find((row) => row.key === SOCIAL_SETTING_KEYS.instagram)?.value,
        ""
      ),
      youtube: parseAppSettingString(
        rows.find((row) => row.key === SOCIAL_SETTING_KEYS.youtube)?.value,
        ""
      ),
      tiktok: parseAppSettingString(
        rows.find((row) => row.key === SOCIAL_SETTING_KEYS.tiktok)?.value,
        ""
      ),
      facebook: parseAppSettingString(
        rows.find((row) => row.key === SOCIAL_SETTING_KEYS.facebook)?.value,
        ""
      ),
      whatsapp: parseAppSettingString(
        rows.find((row) => row.key === SOCIAL_SETTING_KEYS.whatsapp)?.value,
        ""
      ),
    };
    return resolveBrandSocialLinks(settingsInput);
  } catch {
    return [];
  }
}
