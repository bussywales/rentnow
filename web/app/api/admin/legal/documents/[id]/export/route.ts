import { NextResponse } from "next/server";
import { renderLegalDocx, renderLegalPdf } from "@/lib/legal/export.server";
import { isLegalContentEmpty } from "@/lib/legal/markdown";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/role";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");
  if (format !== "pdf" && format !== "docx") {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  const { supabase, role } = await resolveServerRole();
  const isAdmin = role === "admin";
  const client = supabase ?? (await createServerSupabaseClient());
  const nowIso = new Date().toISOString();

  let query = client
    .from("legal_documents")
    .select("id, jurisdiction, audience, version, title, content_md, effective_at, status")
    .eq("id", id);

  if (!isAdmin) {
    query = query
      .eq("status", "published")
      .or(`effective_at.is.null,effective_at.lte.${nowIso}`);
  }

  const { data: doc, error } = await query.maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (isLegalContentEmpty(doc.content_md)) {
    return NextResponse.json({ error: "Legal document content is empty" }, { status: 400 });
  }

  const payload = {
    title: doc.title,
    version: doc.version,
    jurisdiction: doc.jurisdiction,
    audience: doc.audience,
    effective_at: doc.effective_at,
    content_md: doc.content_md,
  };

  const buffer =
    format === "pdf" ? await renderLegalPdf(payload) : await renderLegalDocx(payload);
  const body = new Uint8Array(buffer);

  const safeAudience = String(doc.audience).toLowerCase();
  const fileName = `legal-${doc.jurisdiction}-${safeAudience}-v${doc.version}.${format}`;
  const contentType =
    format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const disposition =
    format === "pdf" && searchParams.get("disposition") === "inline"
      ? "inline"
      : "attachment";

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename=\"${fileName}\"`,
    },
  });
}
