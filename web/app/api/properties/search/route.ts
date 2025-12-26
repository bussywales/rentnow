import { NextResponse } from "next/server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import { searchProperties } from "@/lib/search";
import type { ParsedSearchFilters, Property } from "@/lib/types";

function parseFilters(request: Request): ParsedSearchFilters {
  const { searchParams } = new URL(request.url);
  return {
    city: searchParams.get("city"),
    minPrice: searchParams.get("minPrice")
      ? Number(searchParams.get("minPrice"))
      : null,
    maxPrice: searchParams.get("maxPrice")
      ? Number(searchParams.get("maxPrice"))
      : null,
    currency: searchParams.get("currency"),
    bedrooms: searchParams.get("bedrooms")
      ? Number(searchParams.get("bedrooms"))
      : null,
    rentalType: searchParams.get("rentalType") as ParsedSearchFilters["rentalType"],
    furnished:
      searchParams.get("furnished") === "true"
        ? true
        : searchParams.get("furnished") === "false"
        ? false
        : null,
    amenities: searchParams.get("amenities")
      ? String(searchParams.get("amenities"))
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      : [],
  };
}

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
  const filters = parseFilters(request);
  const { page, pageSize } = parsePagination(request);

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
    const { data, error, count } = await searchProperties(filters, { page, pageSize });
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
      Property & { property_images?: Array<{ id: string; image_url: string }> }
    >;
    const properties =
      typed.map((row) => ({
        ...row,
        images: row.property_images?.map((img) => ({
          id: img.id,
          image_url: img.image_url,
        })),
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
