import { NextResponse } from "next/server";
import { z } from "zod";
import { getUserRole, requireUser } from "@/lib/authz";
import { getMessagingPermission } from "@/lib/messaging/permissions";
import { normalizeRole } from "@/lib/roles";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

const revokeSchema = z.object({
  property_id: z.string().uuid(),
  tenant_id: z.string().uuid().optional(),
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
  const routeLabel = "/api/messages/share/revoke";

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
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = auth.supabase;
  const role = await getUserRole(supabase, auth.user.id);
  const { property_id, tenant_id } = parsed.data;

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

  await supabase
    .from("message_thread_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("property_id", property_id)
    .eq("tenant_id", resolvedTenantId)
    .is("revoked_at", null);

  return NextResponse.json({ ok: true });
}
