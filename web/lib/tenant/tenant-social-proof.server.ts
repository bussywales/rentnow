import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEarlyAccessApprovedBefore } from "@/lib/early-access";
import { getTenantPlanForTier } from "@/lib/plans";
import { normalizeRole } from "@/lib/roles";
import { orderImagesWithCover } from "@/lib/properties/images";
import { includeDemoListingsForViewer } from "@/lib/properties/demo";
import type { Property, UserRole } from "@/lib/types";
import type { DiscoveryContext } from "@/lib/tenant/tenant-discovery.server";

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
};

type PropertyEventRow = {
  property_id: string;
  event_type: string;
  occurred_at?: string | null;
  meta?: Record<string, unknown> | null;
};

type SocialProofCounter = {
  propertyId: string;
  views7: number;
  saves7: number;
  views30: number;
  saves30: number;
};

type SocialProofContext = {
  supabase: SupabaseClient;
  role: UserRole | null;
  approvedBefore: string | null;
};

const IMAGE_SELECT = "id,image_url,position,created_at,width,height,bytes,format";
const BASE_SELECT = `*, property_images(${IMAGE_SELECT})`;

type QueryBuilder = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

function mapPropertyRows(rows: PropertyRow[] | null | undefined): Property[] {
  return (rows ?? []).map((row) => ({
    ...row,
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

function normalizeCountryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  return normalized;
}

function sortByMetric(
  counters: SocialProofCounter[],
  metric: "score7" | "saves30" | "views30"
): SocialProofCounter[] {
  return [...counters].sort((a, b) => {
    if (metric === "score7") {
      const aScore = scoreTrendingCounter(a);
      const bScore = scoreTrendingCounter(b);
      if (bScore !== aScore) return bScore - aScore;
      if (b.saves7 !== a.saves7) return b.saves7 - a.saves7;
      if (b.views7 !== a.views7) return b.views7 - a.views7;
      return a.propertyId.localeCompare(b.propertyId);
    }
    if (metric === "saves30") {
      if (b.saves30 !== a.saves30) return b.saves30 - a.saves30;
      if (b.views30 !== a.views30) return b.views30 - a.views30;
      return a.propertyId.localeCompare(b.propertyId);
    }
    if (b.views30 !== a.views30) return b.views30 - a.views30;
    if (b.saves30 !== a.saves30) return b.saves30 - a.saves30;
    return a.propertyId.localeCompare(b.propertyId);
  });
}

function toMillis(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

async function resolveContext(context?: DiscoveryContext): Promise<SocialProofContext> {
  if (context) {
    return {
      supabase: context.supabase,
      role: context.role,
      approvedBefore: context.approvedBefore,
    };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: UserRole | null = null;
  let planTier: string | null = null;
  let validUntil: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = normalizeRole(profile?.role) ?? null;

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
    role,
    approvedBefore,
  };
}

async function fetchEventRows(input: {
  context: SocialProofContext;
  now: Date;
}): Promise<PropertyEventRow[]> {
  const since30Iso = new Date(
    input.now.getTime() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const analyticsClient = hasServiceRoleEnv()
    ? createServiceRoleClient()
    : input.context.supabase;

  const { data, error } = await analyticsClient
    .from("property_events")
    .select("property_id,event_type,occurred_at,meta")
    .in("event_type", ["property_view", "save_toggle"])
    .gte("occurred_at", since30Iso);

  if (error) return [];
  return ((data as PropertyEventRow[] | null) ?? []).filter((row) => Boolean(row.property_id));
}

async function fetchVisibleHomesByIds(input: {
  context: SocialProofContext;
  ids: string[];
}): Promise<Property[]> {
  const ids = Array.from(new Set(input.ids.filter(Boolean)));
  if (!ids.length) return [];

  const nowIso = new Date().toISOString();
  const includeDemo = includeDemoListingsForViewer({ viewerRole: input.context.role });
  let query = input.context.supabase.from("properties").select(BASE_SELECT).in("id", ids);
  query = applyVisibilityFilters(query, nowIso, input.context.approvedBefore, includeDemo);
  const { data, error } = await query;
  if (error) return [];
  return mapPropertyRows(data as PropertyRow[]);
}

export function scoreTrendingCounter(counter: Pick<SocialProofCounter, "views7" | "saves7">): number {
  return Math.max(0, counter.views7) + Math.max(0, counter.saves7) * 4;
}

export function buildSocialProofCounters(
  rows: PropertyEventRow[],
  now: Date = new Date()
): SocialProofCounter[] {
  const since7Ms = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const counters = new Map<string, SocialProofCounter>();

  for (const row of rows) {
    const propertyId = row.property_id;
    if (!propertyId) continue;
    if (!counters.has(propertyId)) {
      counters.set(propertyId, {
        propertyId,
        views7: 0,
        saves7: 0,
        views30: 0,
        saves30: 0,
      });
    }

    const bucket = counters.get(propertyId)!;
    const occurredAtMs = toMillis(row.occurred_at);
    const within7Days = occurredAtMs !== null && occurredAtMs >= since7Ms;

    if (row.event_type === "property_view") {
      bucket.views30 += 1;
      if (within7Days) bucket.views7 += 1;
      continue;
    }

    if (row.event_type === "save_toggle") {
      const action = String((row.meta as { action?: unknown } | null)?.action ?? "").toLowerCase();
      if (action !== "save") continue;
      bucket.saves30 += 1;
      if (within7Days) bucket.saves7 += 1;
    }
  }

  return Array.from(counters.values());
}

export function rankTrendingPropertyIds(counters: SocialProofCounter[], limit: number): string[] {
  return sortByMetric(counters, "score7")
    .filter((counter) => scoreTrendingCounter(counter) >= 3)
    .slice(0, Math.max(0, limit))
    .map((counter) => counter.propertyId);
}

export function rankMostSavedPropertyIds(counters: SocialProofCounter[], limit: number): string[] {
  return sortByMetric(counters, "saves30")
    .filter((counter) => counter.saves30 > 0)
    .slice(0, Math.max(0, limit))
    .map((counter) => counter.propertyId);
}

export function rankMostViewedPropertyIds(counters: SocialProofCounter[], limit: number): string[] {
  return sortByMetric(counters, "views30")
    .filter((counter) => counter.views30 > 0)
    .slice(0, Math.max(0, limit))
    .map((counter) => counter.propertyId);
}

export function prioritizeHomesByMarketCountry(
  homes: Property[],
  marketCountryCode?: string | null
): Property[] {
  const normalized = normalizeCountryCode(marketCountryCode);
  if (!normalized || !homes.length) return homes;

  const preferred: Property[] = [];
  const others: Property[] = [];
  for (const home of homes) {
    const homeCountry = normalizeCountryCode(home.country_code);
    if (homeCountry === normalized) {
      preferred.push(home);
    } else {
      others.push(home);
    }
  }
  return [...preferred, ...others];
}

async function resolveHomesForRankedIds(input: {
  rankedIds: string[];
  limit: number;
  marketCountryCode?: string | null;
  context: SocialProofContext;
}): Promise<Property[]> {
  if (!input.rankedIds.length || input.limit <= 0) return [];
  const fetchLimit = Math.max(input.limit * 6, 80);
  const candidateIds = input.rankedIds.slice(0, fetchLimit);
  const visibleHomes = await fetchVisibleHomesByIds({
    context: input.context,
    ids: candidateIds,
  });
  if (!visibleHomes.length) return [];

  const byId = new Map(visibleHomes.map((home) => [home.id, home]));
  const ordered = candidateIds
    .map((id) => byId.get(id))
    .filter((home): home is Property => Boolean(home));
  return prioritizeHomesByMarketCountry(ordered, input.marketCountryCode).slice(0, input.limit);
}

export async function getTrendingHomes(input: {
  limit?: number;
  marketCountryCode?: string | null;
  context?: DiscoveryContext;
}): Promise<Property[]> {
  const limit = Math.max(1, input.limit ?? 10);
  const context = await resolveContext(input.context);
  const rows = await fetchEventRows({ context, now: new Date() });
  if (!rows.length) return [];
  const counters = buildSocialProofCounters(rows);
  const rankedIds = rankTrendingPropertyIds(counters, limit * 6);
  return resolveHomesForRankedIds({
    rankedIds,
    limit,
    marketCountryCode: input.marketCountryCode ?? null,
    context,
  });
}

export async function getMostSavedHomes(input: {
  limit?: number;
  marketCountryCode?: string | null;
  context?: DiscoveryContext;
}): Promise<Property[]> {
  const limit = Math.max(1, input.limit ?? 10);
  const context = await resolveContext(input.context);
  const rows = await fetchEventRows({ context, now: new Date() });
  if (!rows.length) return [];
  const counters = buildSocialProofCounters(rows);
  const rankedIds = rankMostSavedPropertyIds(counters, limit * 6);
  return resolveHomesForRankedIds({
    rankedIds,
    limit,
    marketCountryCode: input.marketCountryCode ?? null,
    context,
  });
}

export async function getMostViewedHomes(input: {
  limit?: number;
  marketCountryCode?: string | null;
  context?: DiscoveryContext;
}): Promise<Property[]> {
  const limit = Math.max(1, input.limit ?? 10);
  const context = await resolveContext(input.context);
  const rows = await fetchEventRows({ context, now: new Date() });
  if (!rows.length) return [];
  const counters = buildSocialProofCounters(rows);
  const rankedIds = rankMostViewedPropertyIds(counters, limit * 6);
  return resolveHomesForRankedIds({
    rankedIds,
    limit,
    marketCountryCode: input.marketCountryCode ?? null,
    context,
  });
}

