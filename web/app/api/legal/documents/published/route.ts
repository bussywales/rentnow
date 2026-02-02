import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { DEFAULT_JURISDICTION, isLegalAudience } from "@/lib/legal/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const jurisdiction = (searchParams.get("jurisdiction") || DEFAULT_JURISDICTION).toUpperCase();
  const audienceParam = searchParams.get("audience");
  if (!isLegalAudience(audienceParam)) {
    return NextResponse.json({ error: "Missing or invalid audience" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("legal_documents")
    .select("id, jurisdiction, audience, version, status, title, content_md, effective_at, published_at, updated_at, created_at")
    .eq("jurisdiction", jurisdiction)
    .eq("audience", audienceParam)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ document: data });
}
