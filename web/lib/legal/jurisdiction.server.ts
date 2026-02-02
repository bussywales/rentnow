import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_JURISDICTION } from "@/lib/legal/constants";
import { getCountryByName } from "@/lib/countries";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAppSettingString } from "@/lib/settings/app-settings.server";

type ProfileLike = {
  jurisdiction?: string | null;
  country?: string | null;
  country_code?: string | null;
};

type ResolveJurisdictionInput = {
  searchParams?: URLSearchParams | Record<string, string | string[] | undefined>;
  explicitJurisdiction?: string | null;
  userId?: string | null;
  profile?: ProfileLike | null;
  supabase?: SupabaseClient;
};

type ResolveJurisdictionDeps = {
  getAppSettingString?: typeof getAppSettingString;
  fetchProfile?: (supabase: SupabaseClient, userId: string) => Promise<ProfileLike | null>;
};

function normalizeJurisdictionValue(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const country = getCountryByName(trimmed);
  if (country?.code) return country.code;
  return trimmed.toUpperCase();
}

function readSearchParam(
  searchParams?: URLSearchParams | Record<string, string | string[] | undefined>
) {
  if (!searchParams) return null;
  if (searchParams instanceof URLSearchParams) {
    return searchParams.get("jurisdiction");
  }
  const raw = searchParams.jurisdiction;
  if (Array.isArray(raw)) return raw[0];
  return raw ?? null;
}

async function defaultFetchProfile(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return (data as ProfileLike | null) ?? null;
}

export async function resolveJurisdiction(
  input: ResolveJurisdictionInput,
  deps: ResolveJurisdictionDeps = {}
): Promise<string> {
  const paramValue = normalizeJurisdictionValue(readSearchParam(input.searchParams));
  if (paramValue) return paramValue;

  const explicitValue = normalizeJurisdictionValue(input.explicitJurisdiction ?? null);
  if (explicitValue) return explicitValue;

  let profile = input.profile ?? null;
  if (!profile && input.userId) {
    const supabase =
      input.supabase ?? (await createServerSupabaseClient().catch(() => null));
    if (supabase) {
      const fetchProfile = deps.fetchProfile ?? defaultFetchProfile;
      try {
        profile = await fetchProfile(supabase, input.userId);
      } catch {
        profile = null;
      }
    }
  }

  const profileJurisdiction = normalizeJurisdictionValue(
    profile?.jurisdiction ?? profile?.country_code ?? profile?.country ?? null
  );
  if (profileJurisdiction) return profileJurisdiction;

  const getSetting = deps.getAppSettingString ?? getAppSettingString;
  const settingValue = normalizeJurisdictionValue(
    await getSetting("legal_default_jurisdiction", DEFAULT_JURISDICTION)
  );
  return settingValue ?? DEFAULT_JURISDICTION;
}
