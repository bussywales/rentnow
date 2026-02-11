import type { UserRole } from "@/lib/types";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

type SlugLookupRow = {
  id?: string | null;
  public_slug?: string | null;
};

export type SlugLookupClient = {
  from: (table: "profiles") => {
    select: (
      columns: string
    ) => {
      ilike: (column: string, pattern: string) => Promise<{
        data: SlugLookupRow[] | null;
        error: { message?: string; code?: string } | null;
      }>;
    };
  };
};

export type SlugWriteClient = {
  from: (table: "profiles") => {
    update: (values: { public_slug: string }) => {
      eq: (column: string, value: string) => Promise<{
        error: { message?: string; code?: string } | null;
      }>;
    };
  };
};

export type PublicSlugProfile = {
  id: string;
  role?: UserRole | string | null;
  public_slug?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  business_name?: string | null;
};

function safeTrim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function slugifyName(name: string): string {
  return safeTrim(name)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function chooseUniqueSlug(base: string, existing: string[]): string {
  const normalizedBase = slugifyName(base) || "advertiser";
  const used = new Set(
    existing.map((slug) => slugifyName(slug)).filter(Boolean)
  );
  if (!used.has(normalizedBase)) return normalizedBase;
  let suffix = 2;
  while (used.has(`${normalizedBase}-${suffix}`)) {
    suffix += 1;
  }
  return `${normalizedBase}-${suffix}`;
}

function isPublicAdvertiserRole(role?: string | null): role is "agent" | "landlord" {
  return role === "agent" || role === "landlord";
}

function resolveSlugBase(profile: PublicSlugProfile): string {
  const fromDisplay = slugifyName(profile.display_name ?? "");
  if (fromDisplay) return fromDisplay;
  const fromBusiness = slugifyName(profile.business_name ?? "");
  if (fromBusiness) return fromBusiness;
  const fromFullName = slugifyName(profile.full_name ?? "");
  if (fromFullName) return fromFullName;
  return `advertiser-${profile.id.slice(0, 8)}`;
}

export async function ensureUniqueSlug(input: {
  base: string;
  supabase: SlugLookupClient;
  excludeProfileId?: string;
}): Promise<string> {
  const normalizedBase = slugifyName(input.base) || "advertiser";
  const { data, error } = await input.supabase
    .from("profiles")
    .select("id, public_slug")
    .ilike("public_slug", `${normalizedBase}%`);
  if (error) {
    throw new Error(error.message || "Failed to check slug uniqueness.");
  }
  const existing = ((data as SlugLookupRow[] | null) ?? [])
    .filter((row) => row.id !== input.excludeProfileId)
    .map((row) => safeTrim(row.public_slug))
    .filter(Boolean);
  return chooseUniqueSlug(normalizedBase, existing);
}

export async function getOrCreatePublicSlug(input: {
  profile: PublicSlugProfile;
  lookupClient: SlugLookupClient;
  writeClient?: SlugWriteClient;
  canPersist?: boolean;
}): Promise<string | null> {
  if (!isPublicAdvertiserRole(input.profile.role ?? null)) return null;

  const existing = slugifyName(input.profile.public_slug ?? "");
  if (existing) return existing;

  if (!input.canPersist) return null;

  const base = resolveSlugBase(input.profile);
  const writer =
    input.writeClient ??
    (hasServiceRoleEnv()
      ? (createServiceRoleClient() as unknown as SlugWriteClient)
      : null);
  if (!writer) return null;

  let attempt = 0;
  while (attempt < 5) {
    attempt += 1;
    const candidate = await ensureUniqueSlug({
      base,
      supabase: input.lookupClient,
      excludeProfileId: input.profile.id,
    });
    const { error } = await writer
      .from("profiles")
      .update({ public_slug: candidate })
      .eq("id", input.profile.id);
    if (!error) return candidate;
    if (error.code !== "23505") {
      return null;
    }
  }

  return null;
}
