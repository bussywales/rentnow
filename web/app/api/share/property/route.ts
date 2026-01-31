import { NextResponse } from "next/server";
import { z } from "zod";
import { getSiteUrl } from "@/lib/env";
import { getUserRole, requireUser } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { logFailure } from "@/lib/observability";
import { buildPropertyShareToken, canManagePropertyShare, resolvePropertyShareStatus } from "@/lib/sharing/property-share";

const payloadSchema = z.object({
  propertyId: z.string().uuid(),
  rotate: z.boolean().optional(),
});

export async function POST(request: Request) {
  const startTime = Date.now();
  const routeLabel = "/api/share/property";

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Sharing is unavailable." }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const body = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const supabase = auth.supabase;
  const role = await getUserRole(supabase, auth.user.id);

  const { data: property } = await supabase
    .from("properties")
    .select("id, owner_id")
    .eq("id", body.data.propertyId)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  if (!canManagePropertyShare({ role, userId: auth.user.id, ownerId: property.owner_id })) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const nowIso = new Date().toISOString();
  const { data: existing } = await supabase
    .from("property_share_links")
    .select("id, token, expires_at, revoked_at")
    .eq("property_id", property.id)
    .is("revoked_at", null)
    .maybeSingle();

  if (existing && !body.data.rotate) {
    const status = resolvePropertyShareStatus({
      expires_at: existing.expires_at,
      revoked_at: existing.revoked_at ?? null,
    });
    if (status === "active") {
      const siteUrl = await getSiteUrl();
      return NextResponse.json({
        id: existing.id,
        link: `${siteUrl}/share/property/${existing.token}`,
        expires_at: existing.expires_at,
        revoked_at: existing.revoked_at ?? null,
      });
    }
  }

  if (existing) {
    await supabase
      .from("property_share_links")
      .update({ revoked_at: nowIso })
      .eq("id", existing.id);
  }

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
        rotated_from: existing?.id ?? null,
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
      error: new Error("Unable to create share link"),
    });
    return NextResponse.json({ error: "Unable to create share link." }, { status: 500 });
  }

  return NextResponse.json({
    id: createdId,
    link: `${siteUrl}/share/property/${token}`,
    expires_at: expiresAt,
    revoked_at: null,
  });
}
