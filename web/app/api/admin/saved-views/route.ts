import { NextResponse } from "next/server";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { adminSavedViewSchema, normalizeSavedViewPayload } from "@/lib/admin/admin-saved-views";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const routeFilter = params.get("route");

  const client = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  let query = client
    .from("admin_saved_views")
    .select("id,name,route,query_json,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (routeFilter) {
    query = query.eq("route", routeFilter);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ views: data ?? [] });
}

export async function POST(req: Request) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = adminSavedViewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid saved view payload" }, { status: 400 });
  }

  const normalized = normalizeSavedViewPayload(parsed.data);
  const client = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  const { data, error } = await client
    .from("admin_saved_views")
    .insert({
      user_id: user.id,
      name: normalized.name,
      route: normalized.route,
      query_json: normalized.query_json,
    })
    .select("id,name,route,query_json,created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ view: data });
}
