import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { LEGAL_AUDIENCES, DEFAULT_JURISDICTION } from "@/lib/legal/constants";
import { isLegalContentEmpty } from "@/lib/legal/markdown";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

const createSchema = z.object({
  jurisdiction: z.string().trim().min(2).max(10).optional(),
  audience: z.enum(LEGAL_AUDIENCES),
  title: z.string().trim().min(3).max(200),
  content_md: z.string().trim().min(1),
  change_log: z.string().trim().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  const startTime = Date.now();
  const routeLabel = "/api/admin/legal/documents";

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["admin"] });
  if (!auth.ok) return auth.response;

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const jurisdiction = (parsed.data.jurisdiction || DEFAULT_JURISDICTION).toUpperCase();
  const { audience, title, content_md, change_log } = parsed.data;

  if (isLegalContentEmpty(content_md)) {
    return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 });
  }

  const { data: latest } = await auth.supabase
    .from("legal_documents")
    .select("version")
    .eq("jurisdiction", jurisdiction)
    .eq("audience", audience)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;
  const now = new Date().toISOString();

  const { data, error } = await auth.supabase
    .from("legal_documents")
    .insert({
      jurisdiction,
      audience,
      version: nextVersion,
      status: "draft",
      title,
      content_md,
      change_log: change_log || null,
      created_at: now,
      updated_at: now,
    })
    .select("id, jurisdiction, audience, version, status, title, updated_at, created_at, change_log")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ document: data });
}
