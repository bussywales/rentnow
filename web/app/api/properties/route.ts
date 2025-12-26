import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";

const routeLabel = "/api/properties";

const propertySchema = z.object({
  title: z.string().min(3),
  description: z.string().optional().nullable(),
  city: z.string().min(2),
  neighbourhood: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  rental_type: z.enum(["short_let", "long_term"]),
  price: z.number().nonnegative(),
  currency: z.string().min(2),
  bedrooms: z.number().int().nonnegative(),
  bathrooms: z.number().int().nonnegative(),
  furnished: z.boolean(),
  amenities: z.array(z.string()).optional().nullable(),
  available_from: z.string().optional().nullable(),
  max_guests: z.number().int().nullable().optional(),
  bills_included: z.boolean().optional(),
  epc_rating: z.string().optional().nullable(),
  council_tax_band: z.string().optional().nullable(),
  features: z.array(z.string()).optional().nullable(),
  status: z.enum(["draft", "pending", "live", "rejected", "paused"]).optional(),
  is_active: z.boolean().optional(),
  imageUrls: z.array(z.string().url()).optional(),
});

export async function POST(request: Request) {
  const startTime = Date.now();

  if (!hasServerSupabaseEnv()) {
    logFailure({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      { error: "Supabase is not configured; listing creation is unavailable in demo mode." },
      { status: 503 }
    );
  }

  try {
    const auth = await requireRole({
      request,
      route: routeLabel,
      startTime,
      roles: ["landlord", "agent", "admin"],
    });
    if (!auth.ok) return auth.response;

    const supabase = auth.supabase;
    const user = auth.user;

    const body = await request.json();
    const data = propertySchema.parse(body);
    const { imageUrls = [], status, ...rest } = data;
    const isAdmin = auth.role === "admin";
    const normalizedStatus = isAdmin && status ? status : "draft";
    const isActive = normalizedStatus === "pending" || normalizedStatus === "live";
    const isApproved = normalizedStatus === "live";
    const submittedAt = normalizedStatus === "pending" ? new Date().toISOString() : null;
    const approvedAt = normalizedStatus === "live" ? new Date().toISOString() : null;

    const { data: property, error: insertError } = await supabase
      .from("properties")
      .insert({
        ...rest,
        amenities: rest.amenities ?? [],
        features: rest.features ?? [],
        status: normalizedStatus,
        is_active: isActive,
        is_approved: isApproved,
        submitted_at: submittedAt,
        approved_at: approvedAt,
        owner_id: user.id,
      })
      .select("id")
      .single();

    if (insertError) {
      logFailure({
        request,
        route: routeLabel,
        status: 400,
        startTime,
        error: new Error(insertError.message),
      });
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    const propertyId = property?.id;

    if (propertyId && imageUrls.length) {
      await supabase.from("property_images").insert(
        imageUrls.map((url, index) => ({
          property_id: propertyId,
          image_url: url,
          position: index,
        }))
      );
    }

    return NextResponse.json({ id: propertyId });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unable to create property";
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  if (!hasServerSupabaseEnv()) {
    logFailure({
      request,
      route: routeLabel,
      status: 503,
      startTime,
      error: "Supabase env vars missing",
    });
    return NextResponse.json(
      { error: "Supabase is not configured; set env vars to fetch properties.", properties: [] },
      { status: 503 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope");
    const ownerOnly = scope === "own";
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const page = Number(pageParam || "1");
    const pageSize = Number(pageSizeParam || "12");
    const shouldPaginate = pageParam !== null || pageSizeParam !== null;
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safePageSize =
      Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 48) : 12;

    if (ownerOnly) {
      const auth = await requireRole({
        request,
        route: routeLabel,
        startTime,
        roles: ["landlord", "agent", "admin"],
        supabase,
      });
      if (!auth.ok) return auth.response;

    let query = supabase
      .from("properties")
      .select("*, property_images(image_url,id,position)")
      .order("created_at", { ascending: false })
      .order("position", { foreignTable: "property_images", ascending: true });

      if (auth.role !== "admin") {
        query = query.eq("owner_id", auth.user.id);
      }

      const { data, error } = await query;

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

      return NextResponse.json({ properties: data || [] }, { status: 200 });
    }

    let query = supabase
      .from("properties")
      .select("*, property_images(image_url,id,position)", {
        count: shouldPaginate ? "exact" : undefined,
      })
      .eq("is_approved", true)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .order("position", { foreignTable: "property_images", ascending: true });

    if (shouldPaginate) {
      const from = (safePage - 1) * safePageSize;
      const to = from + safePageSize - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

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

    return NextResponse.json(
      {
        properties: data || [],
        page: shouldPaginate ? safePage : undefined,
        pageSize: shouldPaginate ? safePageSize : undefined,
        total: shouldPaginate ? count ?? null : undefined,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to fetch properties";
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: message, properties: [] }, { status: 500 });
  }
}
