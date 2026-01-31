import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/env";
import { getUserRole, requireUser } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import { buildPropertyShareToken, canManagePropertyShare } from "@/lib/sharing/property-share";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  const startTime = Date.now();
  const routeLabel = "/api/share/property/[id]/rotate";

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Sharing is unavailable." }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
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
    .select("id, property_id, expires_at, revoked_at")
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
    .eq("id", shareRow.id);

  const siteUrl = await getSiteUrl();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  let token = "";
  let createdId: string | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    token = buildPropertyShareToken();
    const { data, error } = await supabase
      .from("property_share_links")
      .insert({
        property_id: property.id,
        token,
        created_by: auth.user.id,
        expires_at: expiresAt,
        revoked_at: null,
        rotated_from: shareRow.id,
      })
      .select("id")
      .maybeSingle();
    if (!error) {
      createdId = data?.id ?? null;
      break;
    }
  }

  if (!createdId) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: new Error("Unable to rotate share link"),
    });
    return NextResponse.json({ error: "Unable to rotate share link." }, { status: 500 });
  }

  return NextResponse.json({
    id: createdId,
    link: `${siteUrl}/share/property/${token}`,
    expires_at: expiresAt,
    revoked_at: null,
  });
}
