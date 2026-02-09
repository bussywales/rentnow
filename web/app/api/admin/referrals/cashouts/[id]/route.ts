import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

const routeLabel = "/api/admin/referrals/cashouts/[id]";

const patchSchema = z.object({
  action: z.enum(["approve", "reject", "paid", "void"]),
  admin_note: z.string().max(5000).nullable().optional(),
  payout_reference: z.string().max(300).nullable().optional(),
});

type CashoutAdminRpcResponse = {
  ok?: boolean;
  reason?: string;
  status?: string;
  request_id?: string;
};

function mapStatus(reason: string | undefined): number {
  if (!reason) return 400;
  if (reason === "REQUEST_NOT_FOUND") return 404;
  if (reason === "INVALID_TRANSITION") return 409;
  if (reason === "INSUFFICIENT_CREDITS_DURING_SETTLEMENT") return 409;
  return 400;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["admin"],
  });
  if (!auth.ok) return auth.response;

  if (!hasServiceRoleEnv()) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing request id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  const adminClient = createServiceRoleClient() as unknown as SupabaseClient;
  const { data, error } = await adminClient.rpc("admin_referral_cashout_action", {
    in_request_id: id,
    in_action: parsed.data.action,
    in_admin_note: parsed.data.admin_note ?? null,
    in_payout_reference: parsed.data.payout_reference ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const payload = (data ?? {}) as CashoutAdminRpcResponse;
  if (!payload.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: payload.reason ?? "ACTION_FAILED",
      },
      { status: mapStatus(payload.reason) }
    );
  }

  return NextResponse.json({
    ok: true,
    status: payload.status,
    request_id: payload.request_id,
  });
}
