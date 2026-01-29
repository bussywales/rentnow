import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const checklistSchema = z.object({
  sections: z
    .object({
      media: z.enum(["pass", "needs_fix", "blocker"]).nullable().optional(),
      location: z.enum(["pass", "needs_fix", "blocker"]).nullable().optional(),
      pricing: z.enum(["pass", "needs_fix", "blocker"]).nullable().optional(),
      content: z.enum(["pass", "needs_fix", "blocker"]).nullable().optional(),
      policy: z.enum(["pass", "needs_fix", "blocker"]).nullable().optional(),
    })
    .partial()
    .default({}),
  internalNotes: z.string().optional().default(""),
  warnings: z.array(z.string()).optional().default([]),
});

const DEFAULT_SECTIONS = {
  media: null,
  location: null,
  pricing: null,
  content: null,
  policy: null,
} as const;

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }
  const { id } = await context.params;
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
    .from("admin_review_notes")
    .select("checklist_json, internal_notes, updated_at")
    .eq("property_id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    checklist: data?.checklist_json ?? null,
    internal_notes: data?.internal_notes ?? null,
    updated_at: data?.updated_at ?? null,
  });
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 503 });
  }
  const { id } = await context.params;
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = checklistSchema.safeParse(body?.checklist);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checklist payload" }, { status: 400 });
  }

  const sections = { ...DEFAULT_SECTIONS, ...(parsed.data.sections || {}) };
  const checklist = {
    sections,
    internalNotes: parsed.data.internalNotes ?? "",
    warnings: parsed.data.warnings ?? [],
  };

  const now = new Date().toISOString();
  const client = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  const { error } = await client
    .from("admin_review_notes")
    .upsert(
      {
        property_id: id,
        checklist_json: checklist,
        internal_notes: checklist.internalNotes || null,
        updated_by: user.id,
        updated_at: now,
      },
      { onConflict: "property_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, updated_at: now });
}
