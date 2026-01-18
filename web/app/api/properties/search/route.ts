import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import { getEarlyAccessApprovedBefore } from "@/lib/early-access";
import { searchProperties } from "@/lib/search";
import { parseFiltersFromSearchParams } from "@/lib/search-filters";
import { getTenantPlanForTier } from "@/lib/plans";
import type { Property } from "@/lib/types";
import { orderImagesWithCover } from "@/lib/properties/images";

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

export async function GET(request: Request) {
  const startTime = Date.now();
  const routeLabel = "/api/properties/search";
  const { searchParams } = new URL(request.url);
  const filters = parseFiltersFromSearchParams(searchParams);
  const { page, pageSize } = parsePagination(request);
  const earlyAccessMinutes = getTenantPlanForTier("tenant_pro").earlyAccessMinutes;

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
    let approvedBefore: string | null = null;
    if (earlyAccessMinutes > 0) {
      try {
        const supabase = await createServerSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        let role: string | null = null;
        let planTier: string | null = null;
        let validUntil: string | null = null;
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
          role = profile?.role ?? null;
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
        ({ approvedBefore } = getEarlyAccessApprovedBefore({
          role,
          hasUser: !!user,
          planTier,
          validUntil,
          earlyAccessMinutes,
        }));
      } catch {
        ({ approvedBefore } = getEarlyAccessApprovedBefore({
          role: null,
          hasUser: false,
          planTier: null,
          validUntil: null,
          earlyAccessMinutes,
        }));
      }
    }

    const { data, error, count } = await searchProperties(filters, {
      page,
      pageSize,
      approvedBefore,
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

    const typed = data as Array<
      Property & {
        property_images?: Array<{ id: string; image_url: string; position?: number; created_at?: string }>;
      }
    >;
    const properties =
      typed.map((row) => ({
        ...row,
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
          }))
        ),
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
