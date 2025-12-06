import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results: Record<string, unknown> = {};

  // public read should only return approved + active
  const { data: publicProps, error: publicErr } = await supabase
    .from("properties")
    .select("id, is_approved, is_active")
    .eq("is_approved", true)
    .eq("is_active", true)
    .limit(3);
  results.public_properties = { count: publicProps?.length ?? 0, error: publicErr?.message ?? null };

  // owner-only visibility
  const { data: ownerProps } = await supabase
    .from("properties")
    .select("id")
    .eq("owner_id", user.id)
    .limit(3);
  results.owner_sample = { count: ownerProps?.length ?? 0 };

  // saved_properties isolation
  const { data: saved, error: savedErr } = await supabase
    .from("saved_properties")
    .select("id, user_id, property_id")
    .eq("user_id", user.id)
    .limit(3);
  results.saved = { count: saved?.length ?? 0, error: savedErr?.message ?? null };

  return NextResponse.json({ ok: true, results });
}
