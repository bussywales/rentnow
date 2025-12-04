import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = propertySchema.parse(body);

    const { data: property, error: insertError } = await supabase
      .from("properties")
      .insert({
        ...data,
        amenities: data.amenities ?? [],
        owner_id: user.id,
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    const propertyId = property?.id;

    if (propertyId && data.imageUrls?.length) {
      await supabase.from("property_images").insert(
        data.imageUrls.map((url) => ({
          property_id: propertyId,
          image_url: url,
        }))
      );
    }

    return NextResponse.json({ id: propertyId });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unable to create property";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json(
      { error: "Supabase is not configured; set env vars to fetch properties.", properties: [] },
      { status: 503 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("properties")
      .select("*, property_images(image_url,id)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message, properties: [] }, { status: 400 });
    }

    return NextResponse.json({ properties: data || [] }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to fetch properties";
    return NextResponse.json({ error: message, properties: [] }, { status: 500 });
  }
}
