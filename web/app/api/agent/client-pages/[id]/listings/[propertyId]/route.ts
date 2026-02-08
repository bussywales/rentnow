import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { safeTrim } from "@/lib/agents/agent-storefront";

const routeLabel = "/api/agent/client-pages/[id]/listings/[propertyId]";

const updateSchema = z.object({
  pinned: z.boolean().optional(),
  rank: z.number().int().min(0).optional(),
});

type RouteContext = { params: Promise<{ id: string; propertyId: string }> };

type PageRow = { id: string; agent_user_id: string };

type CuratedRow = {
  client_page_id: string;
  property_id: string;
  rank: number;
  pinned: boolean;
};

async function ensureOwnership(
  supabase: SupabaseClient,
  pageId: string,
  userId: string
) {
  const { data } = await supabase
    .from("agent_client_pages")
    .select("id, agent_user_id")
    .eq("id", pageId)
    .maybeSingle();
  if (!data) return { ok: false, status: 404, error: "Client page not found." };
  if (data.agent_user_id !== userId) return { ok: false, status: 403, error: "Forbidden." };
  return { ok: true, page: data as PageRow };
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const startTime = Date.now();
  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["agent"] });
  if (!auth.ok) return auth.response;

  const resolvedParams = await params;
  const pageId = safeTrim(resolvedParams?.id);
  const propertyId = safeTrim(resolvedParams?.propertyId);
  if (!pageId || !propertyId) {
    return NextResponse.json({ error: "Missing client page or property id." }, { status: 400 });
  }

  const payload = updateSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const ownership = await ensureOwnership(auth.supabase, pageId, auth.user.id);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  const updates: Record<string, unknown> = {};
  if (payload.data.pinned !== undefined) updates.pinned = payload.data.pinned;
  if (payload.data.rank !== undefined) updates.rank = payload.data.rank;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  const { data: listing, error } = await auth.supabase
    .from("agent_client_page_listings")
    .update(updates)
    .eq("client_page_id", pageId)
    .eq("property_id", propertyId)
    .select("client_page_id, property_id, rank, pinned")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ listing: (listing as CuratedRow) ?? null }, { status: 200 });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const startTime = Date.now();
  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["agent"] });
  if (!auth.ok) return auth.response;

  const resolvedParams = await params;
  const pageId = safeTrim(resolvedParams?.id);
  const propertyId = safeTrim(resolvedParams?.propertyId);
  if (!pageId || !propertyId) {
    return NextResponse.json({ error: "Missing client page or property id." }, { status: 400 });
  }

  const ownership = await ensureOwnership(auth.supabase, pageId, auth.user.id);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  const { error } = await auth.supabase
    .from("agent_client_page_listings")
    .delete()
    .eq("client_page_id", pageId)
    .eq("property_id", propertyId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
