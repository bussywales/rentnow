import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { evaluateCashoutRisk } from "@/lib/referrals/cashout-risk.server";
import { validateCashoutActionTransition } from "@/lib/referrals/cashout-admin.server";

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

type RawRequestRow = {
  id: string;
  user_id: string;
  country_code: string;
  credits_requested: number;
  cash_amount: number;
  currency: string;
  status: "pending" | "approved" | "rejected" | "paid" | "void";
};

function mapStatus(reason: string | undefined): number {
  if (!reason) return 400;
  if (reason === "REQUEST_NOT_FOUND") return 404;
  if (reason === "INVALID_TRANSITION") return 409;
  if (reason === "INSUFFICIENT_CREDITS_DURING_SETTLEMENT") return 409;
  return 400;
}

function deriveQueueStatus(input: {
  status: RawRequestRow["status"];
  requiresManualApproval: boolean;
  riskLevel: "none" | "low" | "medium" | "high";
}) {
  if (
    input.status === "pending" &&
    (input.requiresManualApproval || input.riskLevel === "medium" || input.riskLevel === "high")
  ) {
    return "held" as const;
  }
  return input.status;
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

  const adminNote = String(parsed.data.admin_note || "").trim();
  const payoutReference = String(parsed.data.payout_reference || "").trim();
  const action = parsed.data.action;

  const adminClient = createServiceRoleClient() as unknown as SupabaseClient;
  const { data: requestRow } = await adminClient
    .from("referral_cashout_requests")
    .select("id, user_id, country_code, credits_requested, cash_amount, currency, status")
    .eq("id", id)
    .maybeSingle<RawRequestRow>();
  if (!requestRow) {
    return NextResponse.json({ error: "Cashout request not found." }, { status: 404 });
  }

  const countryCode = String(requestRow.country_code || "").trim().toUpperCase();
  const { data: policy } = await adminClient
    .from("referral_jurisdiction_policies")
    .select("requires_manual_approval")
    .eq("country_code", countryCode)
    .maybeSingle<{ requires_manual_approval: boolean | null }>();
  const requiresManualApproval = policy?.requires_manual_approval ?? true;
  const risk = await evaluateCashoutRisk({
    client: adminClient,
    referrerOwnerId: requestRow.user_id,
    countryCode,
    requestedAt: new Date().toISOString(),
  });

  const queueStatus = deriveQueueStatus({
    status: requestRow.status,
    requiresManualApproval,
    riskLevel: risk.risk_level,
  });
  const transition = validateCashoutActionTransition({
    action,
    currentStatus: requestRow.status,
    queueStatus,
    reason: adminNote || null,
  });
  if (!transition.ok) {
    return NextResponse.json({ error: transition.reason }, { status: transition.status });
  }

  const { data, error } = await adminClient.rpc("admin_referral_cashout_action", {
    in_request_id: id,
    in_action: action,
    in_admin_note: adminNote || null,
    in_payout_reference: payoutReference || null,
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

  const nextStatus = String(payload.status || "");
  await adminClient.from("referral_cashout_audit").insert({
    request_id: requestRow.id,
    actor_id: auth.user.id,
    action_type: `cashout_${action}`,
    previous_status: queueStatus,
    new_status: nextStatus,
    reason: adminNote || null,
    meta: {
      reason: adminNote || null,
      previous_status: queueStatus,
      new_status: nextStatus,
      risk_level: risk.risk_level,
      risk_flags: risk.risk_flags,
      country_code: countryCode,
      credits_requested: requestRow.credits_requested,
      cash_amount: requestRow.cash_amount,
      currency: requestRow.currency,
    },
  });

  if (action === "approve") {
    await adminClient.from("referral_cashout_notifications").insert({
      user_id: requestRow.user_id,
      request_id: requestRow.id,
      type: "approved",
      message: "Your cashout request was approved and moved to payout processing.",
    });
  }
  if (action === "reject") {
    await adminClient.from("referral_cashout_notifications").insert({
      user_id: requestRow.user_id,
      request_id: requestRow.id,
      type: "rejected",
      message: adminNote
        ? `Your cashout request was rejected: ${adminNote}`
        : "Your cashout request was rejected.",
    });
  }

  return NextResponse.json({
    ok: true,
    status: payload.status,
    request_id: payload.request_id,
    queue_status: queueStatus,
    risk_level: risk.risk_level,
    risk_flags: risk.risk_flags,
  });
}
