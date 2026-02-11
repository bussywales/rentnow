import { normalizeRole } from "@/lib/roles";

type AdvertiserRole = "agent" | "landlord";

export type PublicAdvertiserProfile = {
  id: string;
  role: AdvertiserRole;
  name: string;
  publicSlug: string | null;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
  createdAt: string | null;
};

export type PublicAdvertiserProfileRow = {
  id?: string | null;
  role?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  business_name?: string | null;
  public_slug?: string | null;
  avatar_url?: string | null;
  city?: string | null;
  country?: string | null;
  created_at?: string | null;
};

export function isPublicAdvertiserRole(value?: string | null): value is AdvertiserRole {
  const role = normalizeRole(value);
  return role === "agent" || role === "landlord";
}

export function derivePublicAdvertiserName(
  row?: Pick<PublicAdvertiserProfileRow, "display_name" | "full_name" | "business_name">
): string {
  const displayName =
    typeof row?.display_name === "string" ? row.display_name.trim() : "";
  if (displayName) return displayName;
  const businessName =
    typeof row?.business_name === "string" ? row.business_name.trim() : "";
  if (businessName) return businessName;
  const fullName = typeof row?.full_name === "string" ? row.full_name.trim() : "";
  if (fullName) return fullName;
  return "Advertiser";
}

export function normalizePublicSlug(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function resolvePublicAdvertiserHref(input: {
  advertiserId?: string | null;
  publicSlug?: string | null;
}): string | null {
  const advertiserId =
    typeof input.advertiserId === "string" ? input.advertiserId.trim() : "";
  if (!advertiserId) return null;
  const slug = normalizePublicSlug(input.publicSlug);
  if (slug) return `/agents/${slug}`;
  return `/u/${advertiserId}`;
}

export function toPublicAdvertiserProfile(
  row: PublicAdvertiserProfileRow | null | undefined
): PublicAdvertiserProfile | null {
  if (!row?.id || !isPublicAdvertiserRole(row.role)) return null;
  return {
    id: row.id,
    role: row.role,
    name: derivePublicAdvertiserName(row),
    publicSlug: normalizePublicSlug(row.public_slug),
    avatarUrl: row.avatar_url ?? null,
    city: row.city ?? null,
    country: row.country ?? null,
    createdAt: row.created_at ?? null,
  };
}
