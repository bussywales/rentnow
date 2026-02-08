import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireOwnership } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

const routeLabel = "/api/agent/commission-agreements/[id]";

const payloadSchema = z.object({
  status: z.enum(["accepted", "declined", "void"]),
});

type RouteContext = { params: Promise<{ id?: string }> };

type AgreementRow = {
  id: string;
  owner_agent_id: string;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireRole({ request, route: routeLabel, startTime, roles: ["agent"] });
  if (!auth.ok) return auth.response;

  const resolvedParams = await params;
  const agreementId = resolvedParams?.id;
  if (!agreementId) {
    return NextResponse.json({ error: "Missing agreement id." }, { status: 400 });
  }

  const payload = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid status update." }, { status: 400 });
  }

  const { data: agreement } = await auth.supabase
    .from("agent_commission_agreements")
    .select("id, owner_agent_id")
    .eq("id", agreementId)
    .maybeSingle();

  if (!agreement) {
    return NextResponse.json({ error: "Agreement not found." }, { status: 404 });
  }

  const ownership = requireOwnership({
    request,
    route: routeLabel,
    startTime,
    resourceOwnerId: (agreement as AgreementRow).owner_agent_id,
    userId: auth.user.id,
    role: auth.role,
  });
  if (!ownership.ok) return ownership.response;

  const updates: Record<string, unknown> = {
    status: payload.data.status,
  };
  if (payload.data.status === "accepted") {
    updates.accepted_at = new Date().toISOString();
  }

  const { data, error } = await auth.supabase
    .from("agent_commission_agreements")
    .update(updates)
    .eq("id", agreementId)
    .select(
      "id, listing_id, owner_agent_id, presenting_agent_id, commission_type, commission_value, currency, status, notes, created_at, accepted_at"
    )
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Unable to update agreement." }, { status: 400 });
  }

  return NextResponse.json({ agreement: data });
}
