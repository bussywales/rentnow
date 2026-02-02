import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { isLegalContentEmpty } from "@/lib/legal/markdown";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const publishSchema = z.object({
  effective_at: z.string().trim().min(1).optional().nullable(),
});

export async function POST(request: Request, { params }: RouteContext) {
  const startTime = Date.now();
  const { id } = await params;
  const routeLabel = `/api/admin/legal/documents/${id}/publish`;

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const parsed = publishSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: doc, error: fetchError } = await auth.supabase
    .from("legal_documents")
    .select("id, jurisdiction, audience, status, title, content_md, effective_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 400 });
  }
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (doc.status === "published") {
    return NextResponse.json({ error: "Document is already published" }, { status: 400 });
  }
  if (isLegalContentEmpty(doc.content_md)) {
    return NextResponse.json({ error: "Legal document content is empty" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const effectiveAt = parsed.data.effective_at || doc.effective_at || null;

  await auth.supabase
    .from("legal_documents")
    .update({ status: "archived", updated_at: now })
    .eq("jurisdiction", doc.jurisdiction)
    .eq("audience", doc.audience)
    .eq("status", "published")
    .neq("id", id);

  const { data, error } = await auth.supabase
    .from("legal_documents")
    .update({
      status: "published",
      published_at: now,
      published_by: auth.user.id,
      effective_at: effectiveAt,
      updated_at: now,
    })
    .eq("id", id)
    .select("id, jurisdiction, audience, version, status, title, effective_at, published_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ document: data });
}
