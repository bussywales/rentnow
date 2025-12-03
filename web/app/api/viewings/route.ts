import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

const viewingSchema = z.object({
  property_id: z.string().uuid(),
  preferred_date: z.string(),
  preferred_time_window: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json(
      { error: "Supabase is not configured; viewing requests are demo-only right now." },
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
    const payload = viewingSchema.parse(body);

    const { data, error } = await supabase
      .from("viewing_requests")
      .insert({
        ...payload,
        tenant_id: user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ viewing: data });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unable to create viewing request";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
