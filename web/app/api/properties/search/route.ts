import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { searchProperties } from "@/lib/search";
import { parseFiltersFromSearchParams } from "@/lib/search-filters";
import { normalizeRole } from "@/lib/roles";
import type { Property } from "@/lib/types";
import { computeLocationScore, extractLocationQuery, type LocationQueryInfo } from "@/lib/properties/location-score";
import { orderImagesWithCover } from "@/lib/properties/images";
import { getAppSettingBool } from "@/lib/settings/app-settings.server";
import { fetchLatestCheckins, buildCheckinSignal } from "@/lib/properties/checkin-signal";
import { includeDemoListingsForViewer } from "@/lib/properties/demo";

function parsePagination(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") || "1");
  const pageSize = Number(searchParams.get("pageSize") || "12");
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize:
      Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 48) : 12,
  };
}

function parseBooleanParam(value: string | null) {
  if (!value) return false;
  return value === "true" || value === "1" || value.toLowerCase() === "yes";
}

function parseRecentDays(value: string | null) {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.min(num, 90);
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const routeLabel = "/api/properties/search";
  const { searchParams } = new URL(request.url);
  const filters = parseFiltersFromSearchParams(searchParams);
  const { page, pageSize } = parsePagination(request);
  const featuredOnly = parseBooleanParam(searchParams.get("featured"));
  const recentDays = parseRecentDays(searchParams.get("recent"));
  const createdAfter =
    recentDays && recentDays > 0
      ? new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  if (!hasServerSupabaseEnv()) {
    logFailure({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      { error: "Supabase is not configured; live search is unavailable.", properties: [] },
      { status: 503 }
    );
  }

  try {
    let viewerRole = null as ReturnType<typeof normalizeRole>;
    try {
      const supabaseForViewer = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabaseForViewer.auth.getUser();
      if (user) {
        viewerRole = normalizeRole(await getUserRole(supabaseForViewer, user.id));
      }
    } catch {
      viewerRole = null;
    }

    const { data, error, count } = await searchProperties(filters, {
      page,
      pageSize,
      featuredOnly,
      createdAfter,
      includeDemo: includeDemoListingsForViewer({ viewerRole }),
    });
    if (error) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(error.message),
      });
      return NextResponse.json({ error: error.message, properties: [] }, { status: 400 });
    }

    const typed = (data ?? []) as Array<
      Property & {
        property_images?: Array<{
          id: string;
          image_url: string;
          position?: number;
          created_at?: string;
          width?: number | null;
          height?: number | null;
          bytes?: number | null;
          format?: string | null;
          storage_path?: string | null;
          original_storage_path?: string | null;
          thumb_storage_path?: string | null;
          card_storage_path?: string | null;
          hero_storage_path?: string | null;
        }>;
      }
    >;
    const queryInfo: LocationQueryInfo = filters.city
      ? extractLocationQuery(filters.city)
      : { tokens: [] };
    const shouldScore = queryInfo.tokens.length > 0 || !!queryInfo.postalPrefix;
    const scored = typed.map((row, index) => ({
      row,
      index,
      score: shouldScore ? computeLocationScore(row, queryInfo) : 0,
    }));
    const orderedRows = scored
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.index - b.index;
      })
      .map((item) => item.row);
    const propertyIds = orderedRows.map((row) => row.id);
    const flagEnabled = await getAppSettingBool("show_tenant_checkin_badge", false);
    const latestCheckins = await fetchLatestCheckins(propertyIds);

    const properties =
      orderedRows.map((row) => ({
        ...row,
        latitude: undefined,
        longitude: undefined,
        images: orderImagesWithCover(
          row.cover_image_url,
          row.property_images?.map((img) => ({
            ...img,
            id: img.id || img.image_url,
            created_at: (img as { created_at?: string | null }).created_at ?? undefined,
            width: (img as { width?: number | null }).width ?? null,
            height: (img as { height?: number | null }).height ?? null,
            bytes: (img as { bytes?: number | null }).bytes ?? null,
            format: (img as { format?: string | null }).format ?? null,
            storage_path: (img as { storage_path?: string | null }).storage_path ?? null,
            original_storage_path:
              (img as { original_storage_path?: string | null }).original_storage_path ?? null,
            thumb_storage_path:
              (img as { thumb_storage_path?: string | null }).thumb_storage_path ?? null,
            card_storage_path:
              (img as { card_storage_path?: string | null }).card_storage_path ?? null,
            hero_storage_path:
              (img as { hero_storage_path?: string | null }).hero_storage_path ?? null,
          }))
        ),
        checkin_signal: buildCheckinSignal(latestCheckins.get(row.id) ?? null, { flagEnabled }),
      })) || [];

    return NextResponse.json({ properties, page, pageSize, total: count ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to search properties";
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: err,
    });
    return NextResponse.json({ error: message, properties: [] }, { status: 500 });
  }

  return NextResponse.json({ properties: [] });
}
