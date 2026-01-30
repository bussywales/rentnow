import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, getUserRole } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getThreadDetail } from "@/lib/messaging/threads";
import { getMessagingPermission } from "@/lib/messaging/permissions";
import { normalizeRole } from "@/lib/roles";
import type { UserRole } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

const replySchema = z.object({
  body: z.string().min(1),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const startTime = Date.now();
  const routeLabel = `/api/messages/thread/${id}`;

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const role = await getUserRole(auth.supabase, auth.user.id);
  const { detail, error } = await getThreadDetail({
    client: auth.supabase,
    userId: auth.user.id,
    role,
    threadId: id,
  });

  if (error || !detail) {
    return NextResponse.json({ error: error || "Thread not found" }, { status: 404 });
  }

  const { data: property } = await auth.supabase
    .from("properties")
    .select("id, owner_id, is_approved, is_active")
    .eq("id", detail.thread.property_id)
    .maybeSingle();

  const { data: recipientProfile } = await auth.supabase
    .from("profiles")
    .select("role")
    .eq("id", role === "tenant" ? detail.thread.host_id : detail.thread.tenant_id)
    .maybeSingle();

  const recipientRole = normalizeRole(recipientProfile?.role ?? null);
  const permission = property
    ? getMessagingPermission({
        senderRole: role,
        senderId: auth.user.id,
        recipientId: role === "tenant" ? detail.thread.host_id : detail.thread.tenant_id,
        propertyOwnerId: property.owner_id,
        propertyPublished: property.is_approved === true && property.is_active === true,
        isOwner: auth.user.id === property.owner_id,
        hasThread: true,
        recipientRole,
      })
    : { allowed: false, code: "property_not_accessible", message: "Listing not found." };

  return NextResponse.json({
    thread: detail.thread,
    messages: detail.messages,
    permission,
  });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const startTime = Date.now();
  const routeLabel = `/api/messages/thread/${id}`;

  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const role = await getUserRole(auth.supabase, auth.user.id);
  if (!role || role === "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = replySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message body" }, { status: 400 });
  }

  const { detail, error } = await getThreadDetail({
    client: auth.supabase,
    userId: auth.user.id,
    role,
    threadId: id,
  });
  if (error || !detail) {
    return NextResponse.json({ error: error || "Thread not found" }, { status: 404 });
  }

  const { data: property } = await auth.supabase
    .from("properties")
    .select("id, owner_id, is_approved, is_active")
    .eq("id", detail.thread.property_id)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const recipientId = role === "tenant" ? detail.thread.host_id : detail.thread.tenant_id;
  const { data: recipientProfile } = await auth.supabase
    .from("profiles")
    .select("role")
    .eq("id", recipientId)
    .maybeSingle();

  const permission = getMessagingPermission({
    senderRole: role,
    senderId: auth.user.id,
    recipientId,
    propertyOwnerId: property.owner_id,
    propertyPublished: property.is_approved === true && property.is_active === true,
    isOwner: auth.user.id === property.owner_id,
    hasThread: true,
    recipientRole: normalizeRole(recipientProfile?.role ?? null),
  });

  if (!permission.allowed) {
    return NextResponse.json({ error: permission.message || "Forbidden", permission }, { status: 403 });
  }

  const now = new Date().toISOString();

  const { data: message, error: insertError } = await auth.supabase
    .from("messages")
    .insert({
      thread_id: detail.thread.id,
      property_id: detail.thread.property_id,
      sender_id: auth.user.id,
      recipient_id: recipientId,
      body: parsed.data.body,
      sender_role: role,
    })
    .select()
    .single();

  if (insertError || !message) {
    return NextResponse.json({ error: insertError?.message || "Unable to send message" }, { status: 400 });
  }

  await auth.supabase.from("message_threads").update({ last_post_at: now }).eq("id", detail.thread.id);

  return NextResponse.json({ message });
}
