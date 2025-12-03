import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const saveSchema = z.object({
  property_id: z.string().uuid(),
});

const supabaseConfigured = () =>
  !!(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );

export async function GET() {
  if (!supabaseConfigured()) {
    return NextResponse.json({
      saved: [],
      note: "Supabase is not configured; favourites are disabled in demo mode.",
    });
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ saved: [] });
  }

  const { data, error } = await supabase
    .from("saved_properties")
    .select("id, property_id, properties(*)")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ saved: data || [] });
}

export async function POST(request: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured; favourites require a live backend." },
      { status: 503 }
    );
  }

  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { property_id } = saveSchema.parse(body);

    const { error } = await supabase
      .from("saved_properties")
      .upsert({ user_id: user.id, property_id });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to save property";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured; favourites require a live backend." },
      { status: 503 }
    );
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("property_id");

  if (!propertyId) {
    return NextResponse.json({ error: "property_id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("saved_properties")
    .delete()
    .eq("user_id", user.id)
    .eq("property_id", propertyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
