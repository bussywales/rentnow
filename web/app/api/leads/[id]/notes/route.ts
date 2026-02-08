import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { canAccessLeadNotes } from "@/lib/leads/lead-notes";
import { logPropertyEvent, resolveEventSessionKey } from "@/lib/analytics/property-events.server";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

const routeLabel = "/api/leads/[id]/notes";

const noteSchema = z.object({
  body: z.string().trim().min(2).max(2000),
});

type RouteContext = { params: Promise<{ id: string }> };

type LeadRow = {
  id: string;
  owner_id: string;
  property_id: string;
};

type NoteRow = {
  id: string;
  lead_id: string;
  author_user_id: string;
  body: string;
  visibility: string;
  created_at: string;
};

async function fetchLead(supabase: SupabaseClient, id: string): Promise<LeadRow | null> {
  const { data } = await supabase
    .from("listing_leads")
    .select("id, owner_id, property_id")
    .eq("id", id)
    .maybeSingle();
  return (data as LeadRow | null) ?? null;
}

export async function GET(request: Request, { params }: RouteContext) {
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

  const lead = await fetchLead(auth.supabase, id);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  if (!canAccessLeadNotes({ role: auth.role, userId: auth.user.id, ownerId: lead.owner_id })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: notes, error } = await auth.supabase
    .from("lead_notes")
    .select("id, lead_id, author_user_id, body, visibility, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: tags } = await auth.supabase
    .from("lead_tags")
    .select("tag")
    .eq("lead_id", id)
    .order("tag", { ascending: true });

  return NextResponse.json({
    notes: (notes as NoteRow[]) ?? [],
    tags: (tags ?? []).map((row) => row.tag),
  });
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

  const payload = noteSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid note payload." }, { status: 400 });
  }

  const lead = await fetchLead(auth.supabase, id);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  if (!canAccessLeadNotes({ role: auth.role, userId: auth.user.id, ownerId: lead.owner_id })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: note, error } = await auth.supabase
    .from("lead_notes")
    .insert({
      lead_id: id,
      author_user_id: auth.user.id,
      visibility: "internal",
      body: payload.data.body,
    })
    .select("id, lead_id, author_user_id, body, visibility, created_at")
    .single();

  if (error || !note) {
    return NextResponse.json({ error: error?.message || "Unable to add note." }, { status: 400 });
  }

  const sessionKey = resolveEventSessionKey({ request, userId: auth.user.id });
  void logPropertyEvent({
    supabase: auth.supabase,
    propertyId: lead.property_id,
    eventType: "lead_note_added",
    actorUserId: auth.user.id,
    actorRole: auth.role,
    sessionKey,
    meta: { lead_id: lead.id, note_id: note.id },
  });

  return NextResponse.json({ note });
}
