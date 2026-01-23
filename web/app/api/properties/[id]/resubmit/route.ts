import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { requireUser, getUserRole } from "@/lib/authz";
import { getListingAccessResult } from "@/lib/role-access";
import { readActingAsFromRequest } from "@/lib/acting-as";
import { hasActiveDelegation } from "@/lib/agent-delegations";
import { validateResubmitStatus } from "@/lib/properties/resubmit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured", code: "SERVER_ERROR" }, { status: 503 });
  }

  const supabase = await createServerSupabaseClient();
  const auth = await requireUser({ request, route: `/api/properties/${id}/resubmit`, startTime, supabase });
  if (!auth.ok) return auth.response;

  const role = await getUserRole(supabase, auth.user.id);
  const access = getListingAccessResult(role, true);
  if (!access.ok) {
    return NextResponse.json({ error: access.message, code: access.code }, { status: access.status });
  }

  const actingAs = readActingAsFromRequest(request);
  let ownerId = auth.user.id;
  if (role === "agent" && actingAs && actingAs !== auth.user.id) {
    const allowed = await hasActiveDelegation(supabase, auth.user.id, actingAs);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden", code: "RESUBMIT_NOT_ALLOWED" }, { status: 403 });
    }
    ownerId = actingAs;
  }

  const { data: property } = await supabase
    .from("properties")
    .select("id, owner_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!property) {
    return NextResponse.json({ error: "Not found", code: "RESUBMIT_NOT_FOUND" }, { status: 404 });
  }

  if (property.owner_id !== ownerId && role !== "admin") {
    return NextResponse.json({ error: "Forbidden", code: "RESUBMIT_NOT_ALLOWED" }, { status: 403 });
  }

  const statusCheck = validateResubmitStatus(property.status);
  if (!statusCheck.ok) {
    return NextResponse.json({ error: statusCheck.message, code: statusCheck.code }, { status: 400 });
  }

  const { error } = await supabase
    .from("properties")
    .update({
      status: "pending",
      is_approved: false,
      is_active: false,
      approved_at: null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Unable to resubmit", code: "SERVER_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "pending" });
}
