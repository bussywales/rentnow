import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

export async function GET() {
  const supabaseReady = hasServerSupabaseEnv();
  if (!supabaseReady) {
    return NextResponse.json(
      { ok: false, supabase: false, error: "Supabase env vars missing" },
      { status: 503 }
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("properties").select("id").limit(1);
    if (error) {
      return NextResponse.json(
        { ok: false, supabase: false, error: error.message },
        { status: 503 }
      );
    }
    return NextResponse.json({ ok: true, supabase: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, supabase: false, error: message },
      { status: 500 }
    );
  }
}
