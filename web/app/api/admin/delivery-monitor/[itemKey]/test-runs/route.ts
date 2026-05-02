import { NextResponse } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireRole } from "@/lib/authz";
import {
  deliveryMonitorTestRunCreateSchema,
  isDeliveryMonitorItemKey,
} from "@/lib/admin/delivery-monitor";
import { loadDeliveryMonitorItem, resolveAdminActorName } from "@/lib/admin/delivery-monitor.server";

const routeLabel = "/api/admin/delivery-monitor/[itemKey]/test-runs";

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

export async function postAdminDeliveryMonitorTestRunResponse(
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
  const parsed = deliveryMonitorTestRunCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid test result payload." },
      { status: 400 }
    );
  }

  const supabase = auth.supabase;
  const testerName = parsed.data.testerName.trim() || (await deps.resolveAdminActorName(supabase, auth.user.id, auth.user.email ?? null));
  const { error } = await supabase.from("delivery_monitor_test_runs").insert({
    item_key: itemKey,
    testing_status: parsed.data.testingStatus,
    tester_name: testerName,
    notes: parsed.data.notes?.trim() || null,
    tested_at: deps.now().toISOString(),
    created_by: auth.user.id,
    created_at: deps.now().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message || "Unable to save test result." }, { status: 500 });
  }

  const item = await deps.loadDeliveryMonitorItem(supabase, itemKey);
  return NextResponse.json({ ok: true, item }, { status: 201 });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ itemKey: string }> }
) {
  const { itemKey } = await context.params;
  return postAdminDeliveryMonitorTestRunResponse(request, itemKey);
}
