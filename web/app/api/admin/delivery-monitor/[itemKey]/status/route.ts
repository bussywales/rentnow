import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireRole } from "@/lib/authz";
import {
  deliveryMonitorStatusUpdateSchema,
  isDeliveryMonitorItemKey,
} from "@/lib/admin/delivery-monitor";
import { loadDeliveryMonitorItem } from "@/lib/admin/delivery-monitor.server";

const routeLabel = "/api/admin/delivery-monitor/[itemKey]/status";

type Deps = {
  hasServerSupabaseEnv: typeof hasServerSupabaseEnv;
  createServerSupabaseClient: typeof createServerSupabaseClient;
  requireRole: typeof requireRole;
  loadDeliveryMonitorItem: typeof loadDeliveryMonitorItem;
  now: () => Date;
};

const defaultDeps: Deps = {
  hasServerSupabaseEnv,
  createServerSupabaseClient,
  requireRole,
  loadDeliveryMonitorItem,
  now: () => new Date(),
};

export async function postAdminDeliveryMonitorStatusResponse(
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
  const parsed = deliveryMonitorStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid status payload." },
      { status: 400 }
    );
  }

  const supabase = auth.supabase;
  const { error } = await supabase.from("delivery_monitor_state_overrides").upsert(
    {
      item_key: itemKey,
      status: parsed.data.status,
      updated_by: auth.user.id,
      updated_at: deps.now().toISOString(),
    },
    { onConflict: "item_key" }
  );

  if (error) {
    return NextResponse.json({ error: error.message || "Unable to save delivery status." }, { status: 500 });
  }

  const item = await deps.loadDeliveryMonitorItem(supabase, itemKey);
  return NextResponse.json({ ok: true, item }, { status: 200 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ itemKey: string }> }
) {
  const { itemKey } = await context.params;
  return postAdminDeliveryMonitorStatusResponse(request, itemKey);
}
