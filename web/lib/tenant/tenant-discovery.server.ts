import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEarlyAccessApprovedBefore } from "@/lib/early-access";
import { getTenantPlanForTier } from "@/lib/plans";
import { normalizeRole } from "@/lib/roles";
import type { Property, UserRole } from "@/lib/types";
import { orderImagesWithCover } from "@/lib/properties/images";
import { includeDemoListingsForViewer } from "@/lib/properties/demo";
import { fetchSavedProperties } from "@/lib/saved-properties.server";
import {
  getMostSavedHomes as getMostSavedHomesSocialProof,
  getMostViewedHomes as getMostViewedHomesSocialProof,
  getTrendingHomes as getTrendingHomesSocialProof,
} from "@/lib/tenant/tenant-social-proof.server";
import { isDiscoverableShortletProperty } from "@/lib/shortlet/discovery";

type PropertyImageRow = {
  id: string;
  image_url: string;
  position?: number | null;
  created_at?: string | null;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  format?: string | null;
};

type PropertyRow = Property & {
  property_images?: PropertyImageRow[] | null;
  shortlet_settings?: Array<{
    property_id?: string | null;
    booking_mode?: "instant" | "request" | null;
    nightly_price_minor?: number | null;
  }> | null;
};

type DiscoveryContext = {
  supabase: SupabaseClient;
  userId: string | null;
  role: UserRole | null;
  approvedBefore: string | null;
  profileCity: string | null;
  profileJurisdiction: string | null;
};

const IMAGE_SELECT = "id,image_url,position,created_at,width,height,bytes,format";
const BASE_SELECT = `*, property_images(${IMAGE_SELECT}), shortlet_settings(property_id,booking_mode,nightly_price_minor,cancellation_policy)`;

function mapPropertyRows(rows: PropertyRow[] | null | undefined): Property[] {
  return (rows ?? []).map((row) => ({
    ...row,
    shortlet_settings: Array.isArray(row.shortlet_settings)
      ? row.shortlet_settings
      : null,
    images: orderImagesWithCover(
      row.cover_image_url,
      row.property_images?.map((img) => ({
        id: img.id || img.image_url,
        image_url: img.image_url,
        position: img.position ?? null,
        created_at: img.created_at ?? undefined,
        width: img.width ?? null,
        height: img.height ?? null,
        bytes: img.bytes ?? null,
        format: img.format ?? null,
      }))
    ),
  }));
}

export function filterShortletHomesForDiscovery(
  homes: Property[],
  options: {
    nowIso?: string;
    includeDemo?: boolean;
  } = {}
): Property[] {
  return homes.filter((home) =>
    isDiscoverableShortletProperty(home, {
      nowIso: options.nowIso,
      includeDemo: options.includeDemo,
    })
  );
}

type QueryBuilder = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

function applyVisibilityFilters(
  query: QueryBuilder,
  nowIso: string,
  approvedBefore: string | null,
  includeDemo: boolean
) {
  let filtered = query
    .eq("status", "live")
    .eq("is_active", true)
    .eq("is_approved", true)
    .or(`expires_at.is.null,expires_at.gte.${nowIso}`);
  if (!includeDemo) {
    filtered = filtered.eq("is_demo", false);
  }

  if (approvedBefore) {
    filtered = filtered.or(`approved_at.is.null,approved_at.lte.${approvedBefore}`);
  }

  return filtered;
}

export async function getTenantDiscoveryContext(): Promise<DiscoveryContext> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: UserRole | null = null;
  let profileCity: string | null = null;
  let profileJurisdiction: string | null = null;
  let planTier: string | null = null;
  let validUntil: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, city, jurisdiction, country, country_code")
      .eq("id", user.id)
      .maybeSingle();

    role = normalizeRole(profile?.role) ?? null;
    profileCity = profile?.city ?? null;
    profileJurisdiction =
      profile?.jurisdiction ?? profile?.country_code ?? profile?.country ?? null;

    if (role === "tenant") {
      const { data: planRow } = await supabase
        .from("profile_plans")
        .select("plan_tier, valid_until")
        .eq("profile_id", user.id)
        .maybeSingle();
      planTier = planRow?.plan_tier ?? null;
      validUntil = planRow?.valid_until ?? null;
    }
  }

  const earlyAccessMinutes = getTenantPlanForTier("tenant_pro").earlyAccessMinutes;
  const { approvedBefore } = getEarlyAccessApprovedBefore({
    role,
    hasUser: !!user,
    planTier,
    validUntil,
    earlyAccessMinutes,
  });

  return {
    supabase,
    userId: user?.id ?? null,
    role,
    approvedBefore,
    profileCity,
    profileJurisdiction,
  };
}

export async function getFeaturedHomes({
  limit = 12,
  context,
}: {
  limit?: number;
  context?: DiscoveryContext;
}) {
  const ctx = context ?? (await getTenantDiscoveryContext());
  const nowIso = new Date().toISOString();
  const includeDemo = includeDemoListingsForViewer({ viewerRole: ctx.role });
  let query = ctx.supabase.from("properties").select(BASE_SELECT);
  query = applyVisibilityFilters(query, nowIso, ctx.approvedBefore, includeDemo)
    .eq("is_featured", true)
    .or(`featured_until.is.null,featured_until.gt.${nowIso}`)
    .order("featured_rank", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  const { data } = await query;
  return mapPropertyRows(data as PropertyRow[]);
}

export async function getPopularHomes({
  city,
  limit = 12,
  context,
}: {
  city?: string | null;
  limit?: number;
  context?: DiscoveryContext;
}) {
  const ctx = context ?? (await getTenantDiscoveryContext());
  const nowIso = new Date().toISOString();
  const includeDemo = includeDemoListingsForViewer({ viewerRole: ctx.role });
  let query = ctx.supabase.from("properties").select(BASE_SELECT);
  query = applyVisibilityFilters(query, nowIso, ctx.approvedBefore, includeDemo).order("updated_at", {
    ascending: false,
  });

  const trimmedCity = city?.trim();
  if (trimmedCity) {
    query = query.ilike("city", `%${trimmedCity}%`);
  }

  const { data } = await query.limit(limit);
  return mapPropertyRows(data as PropertyRow[]);
}

export async function getNewHomes({
  days = 7,
  limit = 12,
  context,
}: {
  days?: number;
  limit?: number;
  context?: DiscoveryContext;
}) {
  const ctx = context ?? (await getTenantDiscoveryContext());
  const nowIso = new Date().toISOString();
  const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const includeDemo = includeDemoListingsForViewer({ viewerRole: ctx.role });

  let query = ctx.supabase.from("properties").select(BASE_SELECT);
  query = applyVisibilityFilters(query, nowIso, ctx.approvedBefore, includeDemo)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });

  const { data } = await query.limit(limit);
  return mapPropertyRows(data as PropertyRow[]);
}

export async function getFallbackHomes({
  limit = 12,
  context,
}: {
  limit?: number;
  context?: DiscoveryContext;
}) {
  const ctx = context ?? (await getTenantDiscoveryContext());
  const nowIso = new Date().toISOString();
  const includeDemo = includeDemoListingsForViewer({ viewerRole: ctx.role });
  let query = ctx.supabase.from("properties").select(BASE_SELECT);
  query = applyVisibilityFilters(query, nowIso, ctx.approvedBefore, includeDemo).order("updated_at", {
    ascending: false,
  });

  const { data } = await query.limit(limit);
  return mapPropertyRows(data as PropertyRow[]);
}

export async function getShortletHomes({
  city,
  limit = 10,
  context,
}: {
  city?: string | null;
  limit?: number;
  context?: DiscoveryContext;
}) {
  const ctx = context ?? (await getTenantDiscoveryContext());
  const nowIso = new Date().toISOString();
  const includeDemo = includeDemoListingsForViewer({ viewerRole: ctx.role });
  const safeLimit = Math.max(1, Math.min(24, Math.trunc(limit)));

  let query = ctx.supabase.from("properties").select(BASE_SELECT);
  query = applyVisibilityFilters(query, nowIso, ctx.approvedBefore, includeDemo)
    .or("listing_intent.eq.shortlet,rental_type.eq.short_let")
    .order("updated_at", { ascending: false });

  const trimmedCity = city?.trim();
  if (trimmedCity) {
    query = query.ilike("city", `%${trimmedCity}%`);
  }

  const { data } = await query.limit(Math.max(safeLimit * 2, 20));
  const homes = mapPropertyRows(data as PropertyRow[]);
  return filterShortletHomesForDiscovery(homes, { nowIso, includeDemo }).slice(0, safeLimit);
}

export async function getSavedHomes({
  limit = 8,
  context,
}: {
  limit?: number;
  context?: DiscoveryContext;
}) {
  const ctx = context ?? (await getTenantDiscoveryContext());
  if (!ctx.userId) return [];
  return fetchSavedProperties({
    supabase: ctx.supabase,
    userId: ctx.userId,
    limit,
  });
}

export async function getTrendingHomes({
  limit = 10,
  marketCountryCode,
  context,
}: {
  limit?: number;
  marketCountryCode?: string | null;
  context?: DiscoveryContext;
}) {
  return getTrendingHomesSocialProof({ limit, marketCountryCode, context });
}

export async function getMostSavedHomes({
  limit = 10,
  marketCountryCode,
  context,
}: {
  limit?: number;
  marketCountryCode?: string | null;
  context?: DiscoveryContext;
}) {
  return getMostSavedHomesSocialProof({ limit, marketCountryCode, context });
}

export async function getMostViewedHomes({
  limit = 10,
  marketCountryCode,
  context,
}: {
  limit?: number;
  marketCountryCode?: string | null;
  context?: DiscoveryContext;
}) {
  return getMostViewedHomesSocialProof({ limit, marketCountryCode, context });
}

export function getCityCollections() {
  return [
    { city: "Lagos", caption: "Lekki · Ikoyi · Victoria Island" },
    { city: "Nairobi", caption: "Kilimani · Westlands · Lavington" },
    { city: "Accra", caption: "East Legon · Airport · Cantonments" },
    { city: "Johannesburg", caption: "Sandton · Rosebank · Melrose" },
    { city: "Kigali", caption: "Kiyovu · Nyarutarama · Kimihurura" },
    { city: "Cairo", caption: "Zamalek · Maadi · New Cairo" },
  ];
}

export function buildTenantDiscoveryModules(input: {
  featuredHomes: Property[];
  popularHomes: Property[];
  newHomes: Property[];
}) {
  const hasFeatured = input.featuredHomes.length > 0;
  const hasPopular = input.popularHomes.length > 0;
  const hasNew = input.newHomes.length > 0;
  return {
    hasFeatured,
    hasPopular,
    hasNew,
    hasModules: hasFeatured || hasPopular || hasNew,
  };
}

export type { DiscoveryContext };
