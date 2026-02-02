import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { isLegalContentEmpty } from "@/lib/legal/markdown";
import { canEditLegalDocument } from "@/lib/legal/workflow";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  content_md: z.string().trim().min(1).optional(),
  change_log: z.string().trim().max(500).optional().nullable(),
});

export async function PUT(request: Request, { params }: RouteContext) {
  const startTime = Date.now();
  const { id } = await params;
  const routeLabel = `/api/admin/legal/documents/${id}`;

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await auth.supabase
    .from("legal_documents")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 400 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (!canEditLegalDocument(existing.status)) {
    return NextResponse.json({ error: "Published documents cannot be edited" }, { status: 400 });
  }

  if (parsed.data.content_md !== undefined && isLegalContentEmpty(parsed.data.content_md)) {
    return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.content_md !== undefined) updates.content_md = parsed.data.content_md;
  if (parsed.data.change_log !== undefined) updates.change_log = parsed.data.change_log;

  const { data, error } = await auth.supabase
    .from("legal_documents")
    .update(updates)
    .eq("id", id)
    .select("id, jurisdiction, audience, version, status, title, updated_at, created_at, change_log")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ document: data });
}
