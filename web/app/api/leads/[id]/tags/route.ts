import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { canAccessLeadNotes, normalizeLeadTag } from "@/lib/leads/lead-notes";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

const routeLabel = "/api/leads/[id]/tags";

const tagSchema = z.object({
  tag: z.string().min(1).max(64),
});

type RouteContext = { params: Promise<{ id: string }> };

type LeadRow = {
  id: string;
  owner_id: string;
};

async function fetchLead(supabase: any, id: string): Promise<LeadRow | null> {
  const { data } = await supabase
    .from("listing_leads")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();
  return (data as LeadRow | null) ?? null;
}

export async function POST(request: Request, { params }: RouteContext) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing lead id." }, { status: 400 });
  }

  const payload = tagSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid tag payload." }, { status: 400 });
  }

  const normalized = normalizeLeadTag(payload.data.tag);
  if (!normalized) {
    return NextResponse.json({ error: "Invalid tag." }, { status: 400 });
  }

  const lead = await fetchLead(auth.supabase, id);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  if (!canAccessLeadNotes({ role: auth.role, userId: auth.user.id, ownerId: lead.owner_id })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await auth.supabase
    .from("lead_tags")
    .upsert({ lead_id: id, tag: normalized }, { onConflict: "lead_id,tag" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ tag: normalized });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing lead id." }, { status: 400 });
  }

  const payload = tagSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid tag payload." }, { status: 400 });
  }

  const normalized = normalizeLeadTag(payload.data.tag);
  if (!normalized) {
    return NextResponse.json({ error: "Invalid tag." }, { status: 400 });
  }

  const lead = await fetchLead(auth.supabase, id);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  if (!canAccessLeadNotes({ role: auth.role, userId: auth.user.id, ownerId: lead.owner_id })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await auth.supabase
    .from("lead_tags")
    .delete()
    .eq("lead_id", id)
    .eq("tag", normalized);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
