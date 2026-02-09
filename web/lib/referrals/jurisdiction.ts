import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCountryByCode,
  getCountryByName,
  normalizeCountryCode,
} from "@/lib/countries";

const DEFAULT_COUNTRY_CODE = "NG";

type ProfileCountryRow = {
  country: string | null;
  country_code?: string | null;
};

type AuthAdminUserResponse = {
  data?: {
    user?: {
      user_metadata?: Record<string, unknown> | null;
    } | null;
  } | null;
};

export type UserJurisdictionResult = {
  countryCode: string;
  source: "profile.country" | "profile.country_code" | "auth.metadata.country" | "default";
};

function normalizeCountryInput(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalizedCode = normalizeCountryCode(trimmed);
  if (normalizedCode) {
    const byCode = getCountryByCode(normalizedCode);
    if (byCode?.code) return byCode.code;
  }

  const byName = getCountryByName(trimmed);
  if (byName?.code) return byName.code;

  return normalizedCode;
}

async function getAuthMetadataCountry(
  serverSupabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  try {
    const adminAuth = (
      serverSupabase as unknown as {
        auth?: {
          admin?: {
            getUserById?: (id: string) => Promise<AuthAdminUserResponse>;
          };
        };
      }
    )?.auth?.admin;

    if (typeof adminAuth?.getUserById !== "function") return null;

    const result = await adminAuth.getUserById(userId);
    const metadata = result?.data?.user?.user_metadata;
    return normalizeCountryInput(metadata?.country);
  } catch {
    return null;
  }
}

export async function getUserJurisdiction(
  serverSupabase: SupabaseClient,
  userId: string,
  options?: { authMetadataCountry?: string | null; defaultCountryCode?: string }
): Promise<UserJurisdictionResult> {
  const defaultCountryCode =
    normalizeCountryInput(options?.defaultCountryCode || DEFAULT_COUNTRY_CODE) || DEFAULT_COUNTRY_CODE;

  const { data: profile } = await serverSupabase
    .from("profiles")
    .select("country, country_code")
    .eq("id", userId)
    .maybeSingle<ProfileCountryRow>();

  const profileCountry = normalizeCountryInput(profile?.country);
  if (profileCountry) {
    return { countryCode: profileCountry, source: "profile.country" };
  }

  const profileCountryCode = normalizeCountryInput(profile?.country_code);
  if (profileCountryCode) {
    return { countryCode: profileCountryCode, source: "profile.country_code" };
  }

  const fromProvidedMetadata = normalizeCountryInput(options?.authMetadataCountry);
  if (fromProvidedMetadata) {
    return { countryCode: fromProvidedMetadata, source: "auth.metadata.country" };
  }

  const fromAuthAdmin = await getAuthMetadataCountry(serverSupabase, userId);
  if (fromAuthAdmin) {
    return { countryCode: fromAuthAdmin, source: "auth.metadata.country" };
  }

  return { countryCode: defaultCountryCode, source: "default" };
}
