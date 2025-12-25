import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getEnvPresence } from "@/lib/env";

function getRequestId(request: Request) {
  return request.headers.get("x-request-id") || request.headers.get("x-vercel-id");
}

function logApiFailure(
  request: Request,
  status: number,
  message: string,
  meta: Record<string, unknown> = {}
) {
  const requestId = getRequestId(request);
  console.error("[api/properties] request failed", {
    status,
    url: request.url,
    requestId: requestId || undefined,
    env: getEnvPresence(),
    message,
    ...meta,
  });
}

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
  is_active: z.boolean().optional(),
  imageUrls: z.array(z.string().url()).optional(),
});

export async function POST(request: Request) {
  if (!hasServerSupabaseEnv()) {
    logApiFailure(request, 503, "Supabase env vars missing");
    return NextResponse.json(
      { error: "Supabase is not configured; listing creation is unavailable in demo mode." },
      { status: 503 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logApiFailure(request, 401, "Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = propertySchema.parse(body);
    const { imageUrls = [], ...rest } = data;

    const { data: property, error: insertError } = await supabase
      .from("properties")
      .insert({
        ...rest,
        amenities: rest.amenities ?? [],
        owner_id: user.id,
      })
      .select("id")
      .single();

    if (insertError) {
      logApiFailure(request, 400, "Insert failed", {
        error: insertError.message,
        owner_id: user.id,
      });
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    const propertyId = property?.id;

    if (propertyId && imageUrls.length) {
      await supabase.from("property_images").insert(
        imageUrls.map((url) => ({
          property_id: propertyId,
          image_url: url,
        }))
      );
    }

    return NextResponse.json({ id: propertyId });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unable to create property";
    logApiFailure(request, 500, "Unhandled error on POST", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!hasServerSupabaseEnv()) {
    logApiFailure(request, 503, "Supabase env vars missing");
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

    if (ownerOnly) {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        logApiFailure(request, 401, "Unauthorized", { scope });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const isAdmin = profile?.role === "admin";

      let query = supabase
        .from("properties")
        .select("*, property_images(image_url,id)")
        .order("created_at", { ascending: false });

      if (!isAdmin) {
        query = query.eq("owner_id", user.id);
      }

      const { data, error } = await query;

      if (error) {
        logApiFailure(request, 400, "Fetch failed", { error: error.message, scope });
        return NextResponse.json({ error: error.message, properties: [] }, { status: 400 });
      }

      return NextResponse.json({ properties: data || [] }, { status: 200 });
    }

    const { data, error } = await supabase
      .from("properties")
      .select("*, property_images(image_url,id)")
      .order("created_at", { ascending: false });

    if (error) {
      logApiFailure(request, 400, "Fetch failed", { error: error.message });
      return NextResponse.json({ error: error.message, properties: [] }, { status: 400 });
    }

    return NextResponse.json({ properties: data || [] }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to fetch properties";
    logApiFailure(request, 500, "Unhandled error on GET", { error: message });
    return NextResponse.json({ error: message, properties: [] }, { status: 500 });
  }
}
