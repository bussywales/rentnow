import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { APP_SETTING_KEYS } from "@/lib/settings/app-settings-keys";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import type { UntypedAdminClient } from "@/lib/supabase/untyped";
import { orderImagesWithCover } from "@/lib/properties/images";
import { normalizeRole } from "@/lib/roles";
import type { Property } from "@/lib/types";

const routeLabel = "/api/agent/network/listings";

const IMAGE_SELECT = "id,image_url,position,created_at,width,height,bytes,format";
const PROPERTY_SELECT = `id, title, city, neighbourhood, state_region, country_code, price, currency, bedrooms, bathrooms, rental_type, rent_period, listing_intent, listing_type, cover_image_url, owner_id, status, property_images(${IMAGE_SELECT}),
  owner:profiles!properties_owner_id_fkey(id, full_name, display_name, business_name, role)`;

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
  owner?: {
    id?: string | null;
    full_name?: string | null;
    display_name?: string | null;
    business_name?: string | null;
    role?: string | null;
  } | null;
};

export type AgentNetworkListingsDeps = {
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  requireRole: typeof requireRole;
  getAppSettingBool: typeof getAppSettingBool;
  createServiceRoleClient: typeof createServiceRoleClient;
};

const defaultDeps: AgentNetworkListingsDeps = {
  hasServiceRoleEnv,
  requireRole,
  getAppSettingBool,
  createServiceRoleClient,
};

function parseNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapPropertyRows(rows: PropertyRow[]): Property[] {
  return rows.map((row) => ({
    ...row,
    owner_profile: row.owner
      ? {
          ...row.owner,
          role: normalizeRole(row.owner.role),
        }
      : null,
    owner_display_name:
      row.owner?.display_name ||
      row.owner?.full_name ||
      row.owner?.business_name ||
      null,
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

export async function getAgentNetworkListingsResponse(
  request: Request,
  deps: AgentNetworkListingsDeps = defaultDeps
) {
  const startTime = Date.now();
  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["agent"],
  });
  if (!auth.ok) return auth.response;

  const flagEnabled = await deps.getAppSettingBool(
    APP_SETTING_KEYS.agentNetworkDiscoveryEnabled,
    false
  );
  if (!flagEnabled) {
    return NextResponse.json(
      { error: "Agent network discovery is disabled." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city")?.trim() || null;
  const intent = searchParams.get("intent")?.trim() || null;
  const minPrice = parseNumber(searchParams.get("minPrice"));
  const maxPrice = parseNumber(searchParams.get("maxPrice"));
  const beds = parseNumber(searchParams.get("beds"));
  const listingType = searchParams.get("type")?.trim() || null;
  const excludeMine = searchParams.get("excludeMine") !== "false";
  const page = Math.max(1, parseNumber(searchParams.get("page")) ?? 1);
  const pageSize = Math.min(24, Math.max(1, parseNumber(searchParams.get("pageSize")) ?? 12));
  const offset = (page - 1) * pageSize;

  const adminClient = deps.createServiceRoleClient() as unknown as UntypedAdminClient;
  let query = adminClient
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("status", "live") as any;

  if (excludeMine) {
    query = query.neq("owner_id", auth.user.id);
  }
  if (city) {
    query = query.ilike("city", `%${city}%`);
  }
  if (intent === "rent" || intent === "buy") {
    query = query.eq("listing_intent", intent);
  }
  if (typeof minPrice === "number") {
    query = query.gte("price", minPrice);
  }
  if (typeof maxPrice === "number") {
    query = query.lte("price", maxPrice);
  }
  if (typeof beds === "number") {
    query = query.gte("bedrooms", beds);
  }
  if (listingType) {
    query = query.eq("listing_type", listingType);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const listings = mapPropertyRows((data as PropertyRow[]) ?? []).filter(
    (listing) => listing.status === "live"
  );

  return NextResponse.json({
    listings,
    page,
    pageSize,
    total: listings.length,
  });
}

export async function GET(request: Request) {
  return getAgentNetworkListingsResponse(request);
}
