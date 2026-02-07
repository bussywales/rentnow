import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { resolveJurisdiction } from "@/lib/legal/jurisdiction.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const jurisdiction = await resolveJurisdiction({ searchParams, supabase });

  const { data: versions, error } = await supabase
    .from("legal_versions")
    .select(
      "jurisdiction, audience, version, document_id, effective_at, published_at, updated_at"
    )
    .eq("jurisdiction", jurisdiction)
    .order("audience", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (versions && versions.length > 0) {
    return NextResponse.json({ ok: true, jurisdiction, versions });
  }

  const now = new Date().toISOString();
  const { data: docs, error: docsError } = await supabase
    .from("legal_documents")
    .select(
      "id, jurisdiction, audience, version, effective_at, published_at, updated_at, status"
    )
    .eq("jurisdiction", jurisdiction)
    .eq("status", "published")
    .or(`effective_at.is.null,effective_at.lte.${now}`)
    .order("audience", { ascending: true })
    .order("version", { ascending: false });

  if (docsError || !docs) {
    return NextResponse.json(
      { error: docsError?.message || "No legal versions available" },
      { status: 400 }
    );
  }

  const latest = new Map<string, (typeof docs)[number]>();
  docs.forEach((doc) => {
    if (!latest.has(doc.audience)) {
      latest.set(doc.audience, doc);
    }
  });

  const fallback = Array.from(latest.values()).map((doc) => ({
    jurisdiction: doc.jurisdiction,
    audience: doc.audience,
    version: doc.version,
    document_id: doc.id,
    effective_at: doc.effective_at,
    published_at: doc.published_at,
    updated_at: doc.updated_at,
  }));

  return NextResponse.json({ ok: true, jurisdiction, versions: fallback });
}
