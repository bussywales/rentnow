import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, requireOwnership } from "@/lib/authz";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

const routeLabel = "/api/agent/commission-agreements/[id]";

const payloadSchema = z.object({
  status: z.enum(["accepted", "declined", "void"]),
  void_reason: z.string().min(10).optional(),
  commission_type: z.enum(["percentage", "fixed", "none"]).optional(),
  commission_value: z.number().min(0).nullable().optional(),
  currency: z.string().max(8).optional(),
  notes: z.string().max(800).optional(),
});

type RouteContext = { params: Promise<{ id?: string }> };

type AgreementRow = {
  id: string;
  owner_agent_id: string;
  status?: string | null;
  terms_locked?: boolean | null;
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
    .select("id, owner_agent_id, status, terms_locked")
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

  const hasTermEdit =
    payload.data.commission_type !== undefined ||
    payload.data.commission_value !== undefined ||
    payload.data.currency !== undefined ||
    payload.data.notes !== undefined;

  if (hasTermEdit && (agreement as AgreementRow).terms_locked) {
    return NextResponse.json(
      { error: "Commission terms are locked after acceptance." },
      { status: 400 }
    );
  }

  if (payload.data.status === "void" && !payload.data.void_reason?.trim()) {
    return NextResponse.json({ error: "Void reason is required." }, { status: 400 });
  }

  if ((agreement as AgreementRow).status === payload.data.status) {
    const { data: current } = await auth.supabase
      .from("agent_commission_agreements")
      .select(
        "id, listing_id, owner_agent_id, presenting_agent_id, commission_type, commission_value, currency, status, notes, created_at, accepted_at, declined_at, voided_at, void_reason, terms_locked, terms_locked_at"
      )
      .eq("id", agreementId)
      .single();

    return NextResponse.json({ agreement: current });
  }

  const updates: Record<string, unknown> = {
    status: payload.data.status,
  };
  if (payload.data.status === "void") {
    updates.void_reason = payload.data.void_reason?.trim() || null;
  }

  const { data, error } = await auth.supabase
    .from("agent_commission_agreements")
    .update(updates)
    .eq("id", agreementId)
    .select(
      "id, listing_id, owner_agent_id, presenting_agent_id, commission_type, commission_value, currency, status, notes, created_at, accepted_at, declined_at, voided_at, void_reason, terms_locked, terms_locked_at"
    )
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Unable to update agreement." }, { status: 400 });
  }

  return NextResponse.json({ agreement: data });
}
