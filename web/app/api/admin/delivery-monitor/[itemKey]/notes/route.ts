import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireRole } from "@/lib/authz";
import {
  deliveryMonitorNoteCreateSchema,
  isDeliveryMonitorItemKey,
} from "@/lib/admin/delivery-monitor";
import { loadDeliveryMonitorItem, resolveAdminActorName } from "@/lib/admin/delivery-monitor.server";

const routeLabel = "/api/admin/delivery-monitor/[itemKey]/notes";

type Deps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  requireRole: typeof requireRole;
  loadDeliveryMonitorItem: typeof loadDeliveryMonitorItem;
  resolveAdminActorName: typeof resolveAdminActorName;
  now: () => Date;
};

const defaultDeps: Deps = {
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  requireRole,
  loadDeliveryMonitorItem,
  resolveAdminActorName,
  now: () => new Date(),
};

export async function postAdminDeliveryMonitorNoteResponse(
  request: Request,
  itemKey: string,
  deps: Deps = defaultDeps
) {
  if (!deps.hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  if (!isDeliveryMonitorItemKey(itemKey)) {
    return NextResponse.json({ error: "Unknown delivery monitor item." }, { status: 404 });
  }

  const auth = await deps.requireRole({
    request,
    route: routeLabel,
    startTime: Date.now(),
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = deliveryMonitorNoteCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid note payload." },
      { status: 400 }
    );
  }

  const supabase = auth.supabase;
  const authorName = await deps.resolveAdminActorName(supabase, auth.user.id, auth.user.email ?? null);
  const { error } = await supabase.from("delivery_monitor_notes").insert({
    item_key: itemKey,
    body: parsed.data.body,
    author_name: authorName,
    created_by: auth.user.id,
    created_at: deps.now().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message || "Unable to save note." }, { status: 500 });
  }

  const item = await deps.loadDeliveryMonitorItem(supabase, itemKey);
  return NextResponse.json({ ok: true, item }, { status: 201 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ itemKey: string }> }
) {
  const { itemKey } = await context.params;
  return postAdminDeliveryMonitorNoteResponse(request, itemKey);
}
