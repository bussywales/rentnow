import { NextResponse } from "next/server";
import { z } from "zod";
import { getSiteUrl } from "@/lib/env";
import { getUserRole, requireUser } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { getMessagingPermission } from "@/lib/messaging/permissions";
import { buildShareToken, buildThreadId } from "@/lib/messaging/share";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { normalizeRole } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

const shareSchema = z.object({
  property_id: z.string().uuid(),
  tenant_id: z.string().uuid().optional(),
  rotate: z.boolean().optional(),
});

type MessagingPermissionCode =
  | "not_authenticated"
  | "role_not_allowed"
  | "conversation_not_allowed"
  | "property_not_accessible"
  | "unknown"
  | "onboarding_incomplete";

function permissionStatus(code?: MessagingPermissionCode) {
  switch (code) {
    case "not_authenticated":
      return 401;
    case "property_not_accessible":
      return 404;
    case "unknown":
      return 503;
    default:
      return 403;
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const routeLabel = "/api/messages/share";

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Messaging is unavailable." }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Sign in to continue.", code: "not_authenticated" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = shareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = auth.supabase;
  const role = await getUserRole(supabase, auth.user.id);
  const { property_id, tenant_id, rotate } = parsed.data;

  const { data: property } = await supabase
    .from("properties")
    .select("id, owner_id, is_approved, is_active")
    .eq("id", property_id)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }

  const ownerId = property.owner_id;
  const propertyPublished = property.is_approved === true && property.is_active === true;

  let resolvedTenantId: string | null = null;
  let recipientId: string | null = null;
  let recipientRole: UserRole | null = null;

  if (role === "tenant") {
    if (tenant_id && tenant_id !== auth.user.id) {
      return NextResponse.json(
        { error: "Forbidden.", code: "role_not_allowed" },
        { status: 403 }
      );
    }
    resolvedTenantId = auth.user.id;
    recipientId = ownerId;
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", ownerId)
      .maybeSingle();
    recipientRole = normalizeRole(ownerProfile?.role ?? null);
  } else if (role === "landlord" || role === "agent") {
    if (ownerId !== auth.user.id) {
      return NextResponse.json(
        { error: "Forbidden.", code: "conversation_not_allowed" },
        { status: 403 }
      );
    }
    if (!tenant_id) {
      return NextResponse.json({ error: "Tenant id is required." }, { status: 400 });
    }
    resolvedTenantId = tenant_id;
    recipientId = tenant_id;
    const { data: tenantProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", tenant_id)
      .maybeSingle();
    recipientRole = normalizeRole(tenantProfile?.role ?? null);
  } else {
    return NextResponse.json(
      { error: "Forbidden.", code: "role_not_allowed" },
      { status: 403 }
    );
  }

  if (!resolvedTenantId || !recipientId) {
    return NextResponse.json({ error: "Unable to resolve participants." }, { status: 400 });
  }

  const { data: threadMessage } = await supabase
    .from("messages")
    .select("sender_id, sender_role")
    .eq("property_id", property_id)
    .or(`sender_id.eq.${resolvedTenantId},recipient_id.eq.${resolvedTenantId}`)
    .limit(1);

  const hasThread = Array.isArray(threadMessage) && threadMessage.length > 0;
  const hasTenantMessage =
    threadMessage?.some(
      (row) =>
        (row as { sender_role?: string | null }).sender_role === "tenant" ||
        row.sender_id === resolvedTenantId
    ) ?? false;

  const permission = getMessagingPermission({
    senderRole: role,
    senderId: auth.user.id,
    recipientId: recipientId ?? "",
    propertyOwnerId: ownerId,
    propertyPublished,
    isOwner: auth.user.id === ownerId,
    hasThread,
    hasTenantMessage,
    recipientRole,
  });

  if (!permission.allowed) {
    return NextResponse.json(
      { error: permission.message, code: permission.code },
      { status: permissionStatus(permission.code as MessagingPermissionCode) }
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();

  const { data: existing } = await supabase
    .from("message_thread_shares")
    .select("id, token, expires_at")
    .eq("property_id", property_id)
    .eq("tenant_id", resolvedTenantId)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (existing && !rotate) {
    const siteUrl = await getSiteUrl();
    return NextResponse.json({
      link: `${siteUrl}/share/messages/${existing.token}`,
      expires_at: existing.expires_at,
    });
  }

  if (existing) {
    await supabase
      .from("message_thread_shares")
      .update({ revoked_at: nowIso })
      .eq("property_id", property_id)
      .eq("tenant_id", resolvedTenantId)
      .is("revoked_at", null);
  }

  const token = buildShareToken();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const threadId = buildThreadId(property_id, resolvedTenantId);

  const { error } = await supabase.from("message_thread_shares").insert({
    thread_id: threadId,
    property_id,
    tenant_id: resolvedTenantId,
    token,
    created_by: auth.user.id,
    expires_at: expiresAt,
  });

  if (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error: new Error(error.message),
    });
    return NextResponse.json({ error: "Unable to create share link." }, { status: 500 });
  }

  const siteUrl = await getSiteUrl();
  return NextResponse.json({
    link: `${siteUrl}/share/messages/${token}`,
    expires_at: expiresAt,
  });
}
