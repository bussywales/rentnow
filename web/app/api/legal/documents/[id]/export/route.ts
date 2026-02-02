import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderLegalDocx, renderLegalPdf } from "@/lib/legal/export.server";
import { isLegalContentEmpty } from "@/lib/legal/markdown";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { LegalAudience } from "@/lib/legal/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

type LegalExportRow = {
  id: string;
  jurisdiction: string;
  audience: LegalAudience;
  version: number;
  title: string;
  content_md: string;
  effective_at?: string | null;
  status: string;
};

type FetchLegalDocument = (input: {
  id: string;
  nowIso: string;
  supabase: SupabaseClient;
}) => Promise<{ data: LegalExportRow | null; error: { message: string } | null }>;

type ExportDeps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  renderLegalPdf: typeof renderLegalPdf;
  renderLegalDocx: typeof renderLegalDocx;
  fetchLegalDocument?: FetchLegalDocument;
};

async function defaultFetchLegalDocument(
  supabase: SupabaseClient,
  id: string,
  nowIso: string
) {
  const { data, error } = await supabase
    .from("legal_documents")
    .select("id, jurisdiction, audience, version, title, content_md, effective_at, status")
    .eq("id", id)
    .eq("status", "published")
    .or(`effective_at.is.null,effective_at.lte.${nowIso}`)
    .maybeSingle();

  return { data: (data as LegalExportRow | null) ?? null, error };
}

function isExportable(doc: LegalExportRow, nowIso: string) {
  if (doc.status !== "published") return false;
  if (!doc.effective_at) return true;
  const effective = Date.parse(doc.effective_at);
  if (Number.isNaN(effective)) return false;
  return effective <= Date.parse(nowIso);
}

function exportFailedResponse() {
  return NextResponse.json(
    { error: "Legal export failed", code: "LEGAL_EXPORT_FAILED" },
    { status: 500 }
  );
}

export async function getPublicLegalExportResponse(
  request: Request,
  { params }: RouteContext,
  deps: ExportDeps
): Promise<Response> {
  const { id } = await params;

  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");
  if (format !== "pdf" && format !== "docx") {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  let doc: LegalExportRow | null = null;
  try {
    const supabase = await deps.createServerSupabaseClient({
      debugContext: { route: `/api/legal/documents/${id}/export` },
    });
    const { data, error } = deps.fetchLegalDocument
      ? await deps.fetchLegalDocument({ id, nowIso, supabase })
      : await defaultFetchLegalDocument(supabase, id, nowIso);

    if (error) {
      console.error("Legal export fetch failed", { id, error });
      return exportFailedResponse();
    }

    doc = data ?? null;
  } catch (error) {
    console.error("Legal export fetch error", { id, error });
    return exportFailedResponse();
  }

  if (!doc || !isExportable(doc, nowIso)) {
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

  let buffer: Buffer;
  try {
    buffer =
      format === "pdf"
        ? await deps.renderLegalPdf(payload)
        : await deps.renderLegalDocx(payload);
  } catch (error) {
    console.error("Legal export render failed", { id, format, error });
    return exportFailedResponse();
  }

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

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposition}; filename=\"${fileName}\"`,
    },
  });
}

export async function GET(request: Request, context: RouteContext) {
  return getPublicLegalExportResponse(request, context, {
    hasServerSupabaseEnv,
    createServerSupabaseClient,
    renderLegalPdf,
    renderLegalDocx,
  });
}
