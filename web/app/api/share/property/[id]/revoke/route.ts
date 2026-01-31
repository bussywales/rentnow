import { NextResponse } from "next/server";
import { getUserRole, requireUser } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { canManagePropertyShare } from "@/lib/sharing/property-share";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Sharing is unavailable." }, { status: 503 });
  }

  const auth = await requireUser({ request, route: "/api/share/property/[id]/revoke", startTime });
  if (!auth.ok) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const { id: shareId } = await params;
  if (!shareId) {
    return NextResponse.json({ error: "Invalid share link." }, { status: 400 });
  }

  const supabase = auth.supabase;
  const role = await getUserRole(supabase, auth.user.id);

  const { data: shareRow } = await supabase
    .from("property_share_links")
    .select("id, property_id")
    .eq("id", shareId)
    .maybeSingle();

  if (!shareRow) {
    return NextResponse.json({ error: "Share link not found." }, { status: 404 });
  }

  const { data: property } = await supabase
    .from("properties")
    .select("id, owner_id")
    .eq("id", shareRow.property_id)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  if (!canManagePropertyShare({ role, userId: auth.user.id, ownerId: property.owner_id })) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from("property_share_links")
    .update({ revoked_at: nowIso })
    .eq("id", shareId);

  return NextResponse.json({ ok: true, revoked_at: nowIso });
}
