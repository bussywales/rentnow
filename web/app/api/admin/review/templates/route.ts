import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const templateSchema = z.object({
  name: z.string().min(1),
  reasons: z.array(z.string()).default([]),
  message: z.string().default(""),
});

export async function GET() {
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

  const client = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  const { data, error } = await client
    .from("admin_message_templates")
    .select("id,name,reasons,message,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ templates: data ?? [] });
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
  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid template payload" }, { status: 400 });
  }

  const client = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  const { data, error } = await client
    .from("admin_message_templates")
    .insert({
      user_id: user.id,
      name: parsed.data.name.trim(),
      reasons: parsed.data.reasons,
      message: parsed.data.message,
    })
    .select("id,name,reasons,message,created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ template: data });
}
