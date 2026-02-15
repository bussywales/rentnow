import { NextResponse, type NextRequest } from "next/server";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { canHostManageShortletBooking } from "@/lib/shortlet/access";

const routeLabel = "/api/shortlet/blocks/[id]";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Block id is required" }, { status: 422 });

  const supabase = await createServerSupabaseClient();
  const { data: blockRow, error: blockError } = await supabase
    .from("shortlet_blocks")
    .select("id,property_id,properties!inner(owner_id)")
    .eq("id", id)
    .maybeSingle();

  if (blockError || !blockRow) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  const relation = blockRow.properties as
    | { owner_id?: string | null }
    | Array<{ owner_id?: string | null }>
    | null
    | undefined;
  const property = Array.isArray(relation) ? (relation[0] ?? null) : relation ?? null;
  const ownerId = String(property?.owner_id || "");

  let canManage = canHostManageShortletBooking({
    actorRole: auth.role,
    actorUserId: auth.user.id,
    hostUserId: ownerId,
    hasDelegation: false,
  });

  if (!canManage && auth.role === "agent") {
    const hasDelegation = await hasActiveDelegation(supabase, auth.user.id, ownerId);
    canManage = canHostManageShortletBooking({
      actorRole: auth.role,
      actorUserId: auth.user.id,
      hostUserId: ownerId,
      hasDelegation,
    });
  }

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceRoleClient() as unknown as {
    from: (table: string) => {
      delete: () => {
        eq: (column: string, value: string) => Promise<{
          error: { message?: string } | null;
        }>;
      };
    };
  };
  const { error: deleteError } = await admin.from("shortlet_blocks").delete().eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message || "Unable to remove block" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}
