import { NextResponse } from "next/server";
import { resolveServerRole } from "@/lib/auth/role";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { isLegalAudience } from "@/lib/legal/constants";
import { resolveJurisdiction } from "@/lib/legal/jurisdiction.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const { supabase, role, user } = await resolveServerRole();
  const jurisdiction = await resolveJurisdiction({
    searchParams,
    userId: user?.id ?? null,
    supabase,
  });
  const audienceParam = searchParams.get("audience");
  const audience = isLegalAudience(audienceParam) ? audienceParam : null;

  const client = supabase ?? (await createServerSupabaseClient());

  let query = client
    .from("legal_documents")
    .select("id, jurisdiction, audience, version, status, title, effective_at, published_at, updated_at, created_at, change_log")
    .eq("jurisdiction", jurisdiction);

  if (audience) {
    query = query.eq("audience", audience);
  }

  if (role !== "admin") {
    const nowIso = new Date().toISOString();
    query = query.eq("status", "published").or(`effective_at.is.null,effective_at.lte.${nowIso}`);
  }

  const { data, error } = await query.order("audience", { ascending: true }).order("version", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ documents: data ?? [] });
}
